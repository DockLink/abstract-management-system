import "dotenv/config";
import { createClient, type User as SupabaseUser } from "@supabase/supabase-js";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  OrgRole,
  EventRoleType,
  PresentationTypeCode,
  BlindMode,
  SubmissionStatus,
  ErcStatus,
  FormFieldType,
} from "../app/generated/prisma/client";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required to run the seed`);
  }
  return value;
}

function createPrisma() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
}

function createSupabaseAdmin() {
  const url = requireEnv("SUPABASE_URL");
  const key =
    process.env.SUPABASE_SECRET_KEY?.trim() || requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function findAuthUserByEmail(
  admin: ReturnType<typeof createSupabaseAdmin>,
  email: string,
): Promise<SupabaseUser | null> {
  const normalized = email.toLowerCase();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;
    const found = data.users.find((u) => u.email?.toLowerCase() === normalized);
    if (found) return found;
    if (data.users.length < 200) break;
  }
  return null;
}

async function upsertSupabaseUser(input: {
  email: string;
  password: string;
  fullName: string;
  isPlatformAdmin?: boolean;
}) {
  const admin = createSupabaseAdmin();
  const email = input.email.toLowerCase().trim();
  const appMetadata = input.isPlatformAdmin
    ? { role: "platform_admin", platform_admin: true }
    : {};
  const userMetadata = { full_name: input.fullName };

  const existing = await findAuthUserByEmail(admin, email);
  if (existing) {
    const { data, error } = await admin.auth.admin.updateUserById(existing.id, {
      password: input.password,
      email_confirm: true,
      app_metadata: {
        ...(existing.app_metadata ?? {}),
        ...appMetadata,
      },
      user_metadata: {
        ...(existing.user_metadata ?? {}),
        ...userMetadata,
      },
    });
    if (error || !data.user) {
      throw new Error(error?.message ?? `Failed to update user: ${email}`);
    }
    return { user: data.user, created: false };
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    app_metadata: appMetadata,
    user_metadata: userMetadata,
  });
  if (error || !data.user) {
    throw new Error(error?.message ?? `Failed to create user: ${email}`);
  }
  return { user: data.user, created: true };
}

async function main() {
  const adminEmail = requireEnv("SEED_ADMIN_EMAIL");
  const adminPassword = requireEnv("SEED_ADMIN_PASSWORD");
  const adminFullName =
    process.env.SEED_ADMIN_FULL_NAME?.trim() || "Platform Admin";

  const submitterEmail =
    process.env.SEED_SUBMITTER_EMAIL?.trim() || "submitter@example.com";
  const submitterPassword =
    process.env.SEED_SUBMITTER_PASSWORD?.trim() || adminPassword;
  const submitterFullName =
    process.env.SEED_SUBMITTER_FULL_NAME?.trim() || "Dr. Sunil Perera";

  const orgName =
    process.env.SEED_ORG_NAME?.trim() || "Demo Medical College";
  const orgSlug = process.env.SEED_ORG_SLUG?.trim() || "demo-college";

  const eventName = "Annual Academic Sessions 2026";
  const eventSlug = "aas-2026";

  const prisma = createPrisma();

  try {
    console.log("Seeding Abstract Management System (Modules 1 & 2)...");

    // 1. Supabase Users & App Users
    const [adminAuth, submitterAuth] = await Promise.all([
      upsertSupabaseUser({
        email: adminEmail,
        password: adminPassword,
        fullName: adminFullName,
        isPlatformAdmin: true,
      }),
      upsertSupabaseUser({
        email: submitterEmail,
        password: submitterPassword,
        fullName: submitterFullName,
        isPlatformAdmin: false,
      }),
    ]);

    const [adminUser, submitterUser] = await Promise.all([
      prisma.user.upsert({
        where: { id: adminAuth.user.id },
        create: {
          id: adminAuth.user.id,
          email: adminEmail.toLowerCase(),
          fullName: adminFullName,
        },
        update: {
          email: adminEmail.toLowerCase(),
          fullName: adminFullName,
        },
      }),
      prisma.user.upsert({
        where: { id: submitterAuth.user.id },
        create: {
          id: submitterAuth.user.id,
          email: submitterEmail.toLowerCase(),
          fullName: submitterFullName,
          slmcNo: "24500",
        },
        update: {
          email: submitterEmail.toLowerCase(),
          fullName: submitterFullName,
          slmcNo: "24500",
        },
      }),
    ]);

    // 2. Organisation
    const organisation = await prisma.organisation.upsert({
      where: { slug: orgSlug },
      create: {
        name: orgName,
        slug: orgSlug,
      },
      update: {
        name: orgName,
      },
    });

    // 3. Organisation Memberships
    await Promise.all([
      prisma.orgMembership.upsert({
        where: {
          orgId_userId: {
            orgId: organisation.id,
            userId: adminUser.id,
          },
        },
        create: {
          orgId: organisation.id,
          userId: adminUser.id,
          role: OrgRole.ORG_ADMIN,
        },
        update: {
          role: OrgRole.ORG_ADMIN,
        },
      }),
      prisma.orgMembership.upsert({
        where: {
          orgId_userId: {
            orgId: organisation.id,
            userId: submitterUser.id,
          },
        },
        create: {
          orgId: organisation.id,
          userId: submitterUser.id,
          role: OrgRole.MEMBER,
        },
        update: {
          role: OrgRole.MEMBER,
        },
      }),
    ]);

    // 4. Sample Organisation Members (for EVT-08 & SUB-14 eligibility verification)
    const sampleMembers = [
      { name: "Dr. Sunil Perera", membershipNo: "M-1001", slmcNo: "24500", email: submitterEmail.toLowerCase() },
      { name: "Dr. Anoma Silva", membershipNo: "M-1002", slmcNo: "28900", email: "anoma.silva@example.com" },
      { name: "Dr. K. Jayawardena", membershipNo: "M-1003", slmcNo: "31200", email: "k.jayawardena@example.com" },
    ];

    for (const m of sampleMembers) {
      const existing = await prisma.member.findFirst({
        where: { orgId: organisation.id, email: m.email },
      });
      if (!existing) {
        await prisma.member.create({
          data: {
            orgId: organisation.id,
            name: m.name,
            membershipNo: m.membershipNo,
            slmcNo: m.slmcNo,
            email: m.email,
          },
        });
      }
    }

    // 5. Event (Module 1: EVT-01, EVT-02, EVT-03)
    const now = new Date();
    const submissionOpenAt = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago (open)
    const submissionCloseAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
    const reviewDeadlineAt = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000);
    const notificationAt = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    const earlyBirdEndAt = new Date(now.getTime() + 70 * 24 * 60 * 60 * 1000);
    const registrationCloseAt = new Date(now.getTime() + 85 * 24 * 60 * 60 * 1000);
    const startsAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const endsAt = new Date(now.getTime() + 92 * 24 * 60 * 60 * 1000);

    const event = await prisma.event.upsert({
      where: {
        orgId_slug: {
          orgId: organisation.id,
          slug: eventSlug,
        },
      },
      create: {
        orgId: organisation.id,
        name: eventName,
        slug: eventSlug,
        edition: "54th Annual Academic Sessions",
        venue: "BMICH, Colombo, Sri Lanka",
        contactEmail: "academic@democollege.lk",
        contactPhone: "+94 11 269 1111",
        startsAt,
        endsAt,
        submissionOpenAt,
        submissionCloseAt,
        reviewDeadlineAt,
        notificationAt,
        earlyBirdEndAt,
        registrationCloseAt,
        primaryColor: "#0284c7",
        blindMode: BlindMode.DOUBLE,
        guidelinesRichText:
          "<p>Welcome to the <strong>54th Annual Academic Sessions</strong>. Authors are invited to submit abstracts for original research, clinical audits, and case reports.</p><p>Please note: All abstracts are strictly limited to <strong>300 words</strong> (excluding title and keywords). Ethical Review Committee (ERC) approval is compulsory for original research.</p>",
      },
      update: {
        name: eventName,
        edition: "54th Annual Academic Sessions",
        venue: "BMICH, Colombo, Sri Lanka",
        submissionOpenAt,
        submissionCloseAt,
        reviewDeadlineAt,
        notificationAt,
        earlyBirdEndAt,
        registrationCloseAt,
        startsAt,
        endsAt,
      },
    });

    // 6. Event Roles
    await Promise.all([
      prisma.eventRole.upsert({
        where: {
          eventId_userId_role: {
            eventId: event.id,
            userId: adminUser.id,
            role: EventRoleType.EVENT_ADMIN,
          },
        },
        create: {
          eventId: event.id,
          userId: adminUser.id,
          role: EventRoleType.EVENT_ADMIN,
        },
        update: {},
      }),
      prisma.eventRole.upsert({
        where: {
          eventId_userId_role: {
            eventId: event.id,
            userId: submitterUser.id,
            role: EventRoleType.SUBMITTER,
          },
        },
        create: {
          eventId: event.id,
          userId: submitterUser.id,
          role: EventRoleType.SUBMITTER,
        },
        update: {},
      }),
    ]);

    // 7. Categories (EVT-04)
    const categoryNames = [
      "Trauma & Emergency Orthopaedics",
      "Spine & Spinal Deformity",
      "Paediatric Orthopaedics",
      "Arthroplasty & Joint Reconstruction",
    ];

    const categoryMap = new Map<string, string>();
    for (let i = 0; i < categoryNames.length; i++) {
      const name = categoryNames[i]!;
      let cat = await prisma.category.findFirst({
        where: { eventId: event.id, name },
      });
      if (!cat) {
        cat = await prisma.category.create({
          data: {
            orgId: organisation.id,
            eventId: event.id,
            name,
            sortOrder: i,
          },
        });
      }
      categoryMap.set(name, cat.id);
    }

    // 8. Presentation Types (EVT-06)
    const presentationTypes = [
      { code: PresentationTypeCode.ORAL, label: "Oral presentation", sortOrder: 0 },
      { code: PresentationTypeCode.POSTER, label: "Poster presentation", sortOrder: 1 },
      { code: PresentationTypeCode.ORAL_OR_POSTER, label: "Oral or poster", sortOrder: 2 },
    ];

    for (const pt of presentationTypes) {
      await prisma.presentationType.upsert({
        where: {
          eventId_code: {
            eventId: event.id,
            code: pt.code,
          },
        },
        create: {
          orgId: organisation.id,
          eventId: event.id,
          code: pt.code,
          label: pt.label,
          sortOrder: pt.sortOrder,
          isActive: true,
        },
        update: {
          label: pt.label,
          isActive: true,
        },
      });
    }

    // 9. Eligibility Rule (EVT-07)
    await prisma.eligibilityRule.upsert({
      where: { eventId: event.id },
      create: {
        orgId: organisation.id,
        eventId: event.id,
        maxAbstractsPerAuthor: 2,
        requireMemberAuthor: false,
        presentingAuthorMustRegister: true,
      },
      update: {
        maxAbstractsPerAuthor: 2,
        requireMemberAuthor: false,
        presentingAuthorMustRegister: true,
      },
    });

    // 10. Submission Types (EVT-05, SUB-02)
    const imradSections = [
      { key: "introduction", label: "Introduction" },
      { key: "objectives", label: "Objectives" },
      { key: "methods", label: "Methods" },
      { key: "results", label: "Results" },
      { key: "conclusions", label: "Conclusions" },
    ];

    const caseReportSections = [
      { key: "background", label: "Background" },
      { key: "case", label: "Case Presentation" },
      { key: "discussion", label: "Discussion & Conclusion" },
    ];

    const submissionTypesData = [
      {
        name: "Original research",
        wordLimit: 300,
        requiresErc: true,
        sections: imradSections,
        sortOrder: 0,
      },
      {
        name: "Clinical audit",
        wordLimit: 300,
        requiresErc: true,
        sections: imradSections,
        sortOrder: 1,
      },
      {
        name: "Case report",
        wordLimit: 300,
        requiresErc: false,
        sections: caseReportSections,
        sortOrder: 2,
      },
    ];

    const typeMap = new Map<string, string>();
    for (const st of submissionTypesData) {
      let t = await prisma.submissionType.findFirst({
        where: { eventId: event.id, name: st.name },
      });
      if (!t) {
        t = await prisma.submissionType.create({
          data: {
            orgId: organisation.id,
            eventId: event.id,
            name: st.name,
            wordLimit: st.wordLimit,
            requiresErc: st.requiresErc,
            sections: st.sections,
            sortOrder: st.sortOrder,
          },
        });
      } else {
        t = await prisma.submissionType.update({
          where: { id: t.id },
          data: {
            wordLimit: st.wordLimit,
            requiresErc: st.requiresErc,
            sections: st.sections,
          },
        });
      }
      typeMap.set(st.name, t.id);
    }

    // 11. Form Fields (Module 2: SUB-01)
    const originalResearchTypeId = typeMap.get("Original research")!;
    const formFieldsData = [
      {
        label: "Study Setting",
        type: FormFieldType.DROPDOWN,
        options: ["Tertiary Referral Hospital", "Base Hospital", "Multi-centre", "Community Setting"],
        required: true,
        helpText: "Select the primary clinical setting of the study.",
        sortOrder: 0,
      },
      {
        label: "Clinical Trial Registry Number",
        type: FormFieldType.TEXT,
        options: null,
        required: false,
        helpText: "Enter SLCTR or WHO trial ID if applicable.",
        sortOrder: 1,
      },
    ];

    for (const ff of formFieldsData) {
      const existingFf = await prisma.formField.findFirst({
        where: { submissionTypeId: originalResearchTypeId, label: ff.label },
      });
      if (!existingFf) {
        await prisma.formField.create({
          data: {
            orgId: organisation.id,
            eventId: event.id,
            submissionTypeId: originalResearchTypeId,
            label: ff.label,
            type: ff.type,
            options: ff.options ? ff.options : undefined,
            required: ff.required,
            helpText: ff.helpText,
            sortOrder: ff.sortOrder,
          },
        });
      }
    }

    // 12. Sample Submissions (Module 2: SUB-11, SUB-12, SUB-16)
    const traumaCatId = categoryMap.get("Trauma & Emergency Orthopaedics");

    // Submission 1: SUBMITTED (AAS26-0001)
    let sub1 = await prisma.submission.findFirst({
      where: { eventId: event.id, refNo: "AAS26-0001" },
    });
    if (!sub1) {
      sub1 = await prisma.submission.create({
        data: {
          orgId: organisation.id,
          eventId: event.id,
          submitterId: submitterUser.id,
          submissionTypeId: originalResearchTypeId,
          categoryId: traumaCatId,
          title: "Management of open tibial fractures: a prospective 5-year multicentre study in Sri Lanka",
          status: SubmissionStatus.SUBMITTED,
          refNo: "AAS26-0001",
          preferredPresentationType: "oral",
          wordCount: 245,
          keywords: ["Tibial fracture", "Fixation", "Outcomes"],
          abstractBody: {
            introduction: "<p>Open tibial fractures present high rates of non-union and deep infection in low- and middle-income trauma systems.</p>",
            objectives: "<p>To evaluate union rates and functional outcomes following protocolized circular frame versus locked intramedullary nailing.</p>",
            methods: "<p>A prospective cohort study was conducted across 4 tertiary trauma centres from 2021 to 2025.</p>",
            results: "<p>A total of 240 patients were analysed. Primary union was achieved in 91.2% with a mean time to union of 18.4 weeks (SD 3.2).</p>",
            conclusions: "<p>Early debridement within 12 hours significantly reduced deep surgical site infections (p &lt; 0.01).</p>",
          },
          customFieldValues: {
            "Study Setting": "Multi-centre",
            "Clinical Trial Registry Number": "SLCTR/2021/008",
          },
          ercStatus: ErcStatus.APPROVED,
          ercInstitution: "ERC, National Hospital of Sri Lanka",
          ercRefNo: "ERC-2021-889",
          declarations: {
            allAuthorsConsented: true,
            noIdentifiablePatientData: true,
            conflictOfInterest: false,
            previouslyPresentedOrPublished: false,
          },
          submittedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
          authors: {
            create: [
              {
                surname: "Perera",
                initials: "S.K.",
                email: submitterEmail.toLowerCase(),
                institution: "National Hospital of Sri Lanka",
                designation: "Senior Registrar",
                slmcNo: "24500",
                membershipNo: "M-1001",
                affiliationNos: [1, 2],
                isPresenting: true,
                isCorresponding: true,
                sortOrder: 0,
              },
              {
                surname: "Silva",
                initials: "A.",
                email: "anoma.silva@example.com",
                institution: "Faculty of Medicine, University of Colombo",
                designation: "Senior Lecturer & Consultant",
                slmcNo: "28900",
                membershipNo: "M-1002",
                affiliationNos: [2],
                isPresenting: false,
                isCorresponding: false,
                sortOrder: 1,
              },
            ],
          },
          affiliations: {
            create: [
              { number: 1, text: "Department of Orthopaedic Surgery, National Hospital of Sri Lanka" },
              { number: 2, text: "Department of Clinical Medicine, Faculty of Medicine, University of Colombo" },
            ],
          },
          versions: {
            create: [
              {
                version: 1,
                content: {
                  title: "Management of open tibial fractures: a prospective 5-year multicentre study in Sri Lanka",
                  status: "SUBMITTED",
                  wordCount: 245,
                },
                createdById: submitterUser.id,
              },
            ],
          },
        },
      });
    }

    // Submission 2: DRAFT (for continuing in wizard)
    const existingDraft = await prisma.submission.findFirst({
      where: { eventId: event.id, submitterId: submitterUser.id, status: SubmissionStatus.DRAFT },
    });
    if (!existingDraft) {
      await prisma.submission.create({
        data: {
          orgId: organisation.id,
          eventId: event.id,
          submitterId: submitterUser.id,
          submissionTypeId: originalResearchTypeId,
          categoryId: traumaCatId,
          title: "Outcomes of minimally invasive percutaneous plate osteosynthesis for distal tibia fractures",
          status: SubmissionStatus.DRAFT,
          preferredPresentationType: "poster",
          wordCount: 160,
          keywords: ["MIPPO", "Distal tibia", "Minimally invasive"],
          abstractBody: {
            introduction: "<p>Minimally invasive percutaneous plate osteosynthesis preserves the periosteal blood supply in distal tibia fractures.</p>",
            objectives: "<p>To investigate soft tissue complication rates and time to radiological union.</p>",
            methods: "<p>A retrospective audit of 65 consecutive patients treated between 2023 and 2024.</p>",
          },
          declarations: {
            allAuthorsConsented: true,
            noIdentifiablePatientData: true,
          },
          authors: {
            create: [
              {
                surname: "Perera",
                initials: "S.K.",
                email: submitterEmail.toLowerCase(),
                institution: "National Hospital of Sri Lanka",
                slmcNo: "24500",
                affiliationNos: [1],
                isPresenting: true,
                isCorresponding: true,
                sortOrder: 0,
              },
            ],
          },
          affiliations: {
            create: [
              { number: 1, text: "Department of Orthopaedic Surgery, National Hospital of Sri Lanka" },
            ],
          },
        },
      });
    }

    // Submission 3: ACCEPTED (AAS26-0002) (for testing "Register now" callout and DEC flow)
    const sub3 = await prisma.submission.findFirst({
      where: { eventId: event.id, refNo: "AAS26-0002" },
    });
    if (!sub3) {
      await prisma.submission.create({
        data: {
          orgId: organisation.id,
          eventId: event.id,
          submitterId: submitterUser.id,
          submissionTypeId: typeMap.get("Clinical audit") || originalResearchTypeId,
          categoryId: traumaCatId,
          title: "Antibiotic stewardship in surgical prophylaxis: a closed-loop clinical audit",
          status: SubmissionStatus.ACCEPTED,
          refNo: "AAS26-0002",
          preferredPresentationType: "either",
          wordCount: 215,
          keywords: ["Antibiotic stewardship", "Surgical prophylaxis", "Audit"],
          abstractBody: {
            introduction: "<p>Appropriate timing of preoperative antibiotics is critical to prevent surgical site infections.</p>",
            objectives: "<p>To assess compliance with national surgical antimicrobial prophylaxis guidelines.</p>",
            methods: "<p>A two-cycle clinical audit with educational intervention and re-auditing at 6 months.</p>",
            results: "<p>Administration within 60 minutes improved from 58.3% to 92.4% following intervention.</p>",
            conclusions: "<p>Closed-loop audit and anaesthetic checklists significantly improve timely antibiotic prophylaxis.</p>",
          },
          ercStatus: ErcStatus.EXEMPT,
          ercInstitution: "Clinical Audit Committee, NHSL",
          declarations: {
            allAuthorsConsented: true,
            noIdentifiablePatientData: true,
            conflictOfInterest: false,
          },
          submittedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
          authors: {
            create: [
              {
                surname: "Perera",
                initials: "S.K.",
                email: submitterEmail.toLowerCase(),
                institution: "National Hospital of Sri Lanka",
                slmcNo: "24500",
                affiliationNos: [1],
                isPresenting: true,
                isCorresponding: true,
                sortOrder: 0,
              },
            ],
          },
          affiliations: {
            create: [
              { number: 1, text: "Department of Orthopaedic Surgery, National Hospital of Sri Lanka" },
            ],
          },
        },
      });
    }

    console.log("\n========================================================");
    console.log("  SEED SUCCESSFUL — Modules 1 & 2 Ready for Testing");
    console.log("========================================================");
    console.log(`  Admin User:      ${adminUser.email} (password: ${adminPassword})`);
    console.log(`  Submitter User:  ${submitterUser.email} (password: ${submitterPassword})`);
    console.log(`  Organisation:    ${organisation.name} (/${organisation.slug})`);
    console.log(`  Event:           ${event.name} (/${organisation.slug}/${event.slug})`);
    console.log(`  Public URL:      http://localhost:3000/${organisation.slug}/${event.slug}`);
    console.log(`  Submitter URL:   http://localhost:3000/${organisation.slug}/${event.slug}/my-submissions`);
    console.log(`  Admin Portal:    http://localhost:3000/org/${organisation.slug}/events/${event.slug}/dashboard`);
    console.log("========================================================\n");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
