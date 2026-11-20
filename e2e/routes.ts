import path from "node:path";

export const ROLES = ["eventadmin", "multi", "reviewer"] as const;
export type Role = (typeof ROLES)[number];
export const authFile = (role: Role) => path.join(__dirname, ".auth", `${role}.json`);

const ORG = process.env.E2E_ORG ?? "demo-college";
const EVENT = process.env.E2E_EVENT ?? "aas-2026";
const portal = `/${ORG}/${EVENT}`;
const admin = `/org/${ORG}/events/${EVENT}`;

export type RouteCheck = {
  name: string;
  path: string;
  as?: Role;
  /** Optional follow-up to reach a state worth scanning (e.g. open a dialog). */
  then?: "firstReview";
};

/** Main routes per audience. Admin routes run as the seeded event admin. */
export const ROUTES: RouteCheck[] = [
  { name: "home", path: "/" },
  { name: "login", path: "/login" },
  { name: "event page", path: portal },
  { name: "my submissions", path: `${portal}/my-submissions`, as: "multi" },
  { name: "submit", path: `${portal}/submit`, as: "multi" },
  { name: "reviewer dashboard", path: `${portal}/reviews`, as: "reviewer" },
  { name: "review screen", path: `${portal}/reviews`, as: "reviewer", then: "firstReview" },
  { name: "my reviews", path: "/my-reviews", as: "reviewer" },
  { name: "admin overview", path: admin, as: "eventadmin" },
  { name: "admin dashboard", path: `${admin}/dashboard`, as: "eventadmin" },
  { name: "admin setup", path: `${admin}/setup`, as: "eventadmin" },
  { name: "admin settings", path: `${admin}/settings`, as: "eventadmin" },
  { name: "admin tracks", path: `${admin}/categories`, as: "eventadmin" },
  { name: "admin submission types", path: `${admin}/submission-types`, as: "eventadmin" },
  { name: "admin eligibility", path: `${admin}/eligibility`, as: "eventadmin" },
  { name: "admin members", path: `${admin}/members`, as: "eventadmin" },
  { name: "admin submissions", path: `${admin}/submissions`, as: "eventadmin" },
  { name: "admin reviews", path: `${admin}/reviews`, as: "eventadmin" },
  { name: "chair reviews", path: `${admin}/reviews`, as: "multi" },
];
