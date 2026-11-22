import { prisma } from "@/lib/db/prisma";

/**
 * Normalize title for comparison: lowercase, strip punctuation, collapse whitespace.
 */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Tokenize string into set of words.
 */
function getTokens(str: string): Set<string> {
  return new Set(normalizeTitle(str).split(" ").filter((w) => w.length > 2));
}

/**
 * Sorensen-Dice coefficient based on bigrams + token overlap.
 */
function calculateSimilarity(str1: string, str2: string): number {
  const norm1 = normalizeTitle(str1);
  const norm2 = normalizeTitle(str2);

  if (norm1 === norm2) return 1.0;
  if (!norm1 || !norm2) return 0.0;

  // Jaccard similarity of words
  const tokens1 = getTokens(norm1);
  const tokens2 = getTokens(norm2);

  if (tokens1.size === 0 || tokens2.size === 0) {
    return 0.0;
  }

  let intersection = 0;
  for (const t of tokens1) {
    if (tokens2.has(t)) intersection++;
  }

  const union = new Set([...tokens1, ...tokens2]).size;
  const wordJaccard = intersection / union;

  // Character bigrams for fine-grained similarity
  const getBigrams = (s: string) => {
    const bigrams = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) {
      bigrams.add(s.slice(i, i + 2));
    }
    return bigrams;
  };

  const bg1 = getBigrams(norm1);
  const bg2 = getBigrams(norm2);
  let bgIntersection = 0;
  for (const b of bg1) {
    if (bg2.has(b)) bgIntersection++;
  }
  const bgDice = (2 * bgIntersection) / (bg1.size + bg2.size || 1);

  // Blend word overlap and bigram dice
  return 0.5 * wordJaccard + 0.5 * bgDice;
}

export type DuplicateMatch = {
  submissionId: string;
  refNo: string | null;
  title: string;
  status: string;
  submitterEmail?: string;
  similarity: number;
};

export type DuplicateCluster = {
  submissionA: { id: string; refNo: string | null; title: string; status: string };
  submissionB: { id: string; refNo: string | null; title: string; status: string };
  similarity: number;
};

export async function findDuplicateTitles(input: {
  eventId: string;
  title?: string;
  excludeId?: string;
  threshold?: number;
}): Promise<{ matches: DuplicateMatch[]; clusters?: DuplicateCluster[] }> {
  const threshold = input.threshold ?? 0.75;

  const submissions = await prisma.submission.findMany({
    where: {
      eventId: input.eventId,
      deletedAt: null,
      status: { not: "WITHDRAWN" },
      ...(input.excludeId ? { id: { not: input.excludeId } } : {}),
    },
    select: {
      id: true,
      refNo: true,
      title: true,
      status: true,
      submitter: { select: { email: true } },
    },
  });

  // Single title comparison mode (e.g. submitter or editor typing a title)
  if (input.title) {
    const queryTitle = input.title;
    const matches: DuplicateMatch[] = [];

    for (const sub of submissions) {
      const score = calculateSimilarity(queryTitle, sub.title);
      if (score >= threshold) {
        matches.push({
          submissionId: sub.id,
          refNo: sub.refNo,
          title: sub.title,
          status: sub.status,
          submitterEmail: sub.submitter.email,
          similarity: Math.round(score * 100) / 100,
        });
      }
    }

    matches.sort((a, b) => b.similarity - a.similarity);
    return { matches };
  }

  // All-pairs event cluster mode for admins
  const clusters: DuplicateCluster[] = [];
  for (let i = 0; i < submissions.length; i++) {
    for (let j = i + 1; j < submissions.length; j++) {
      const s1 = submissions[i]!;
      const s2 = submissions[j]!;
      const score = calculateSimilarity(s1.title, s2.title);
      if (score >= threshold) {
        clusters.push({
          submissionA: { id: s1.id, refNo: s1.refNo, title: s1.title, status: s1.status },
          submissionB: { id: s2.id, refNo: s2.refNo, title: s2.title, status: s2.status },
          similarity: Math.round(score * 100) / 100,
        });
      }
    }
  }

  clusters.sort((a, b) => b.similarity - a.similarity);
  return { matches: [], clusters };
}

