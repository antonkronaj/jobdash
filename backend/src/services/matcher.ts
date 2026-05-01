import natural from 'natural';
import { extractTerms } from './resumeParser.js';
import { embeddingClient } from './embeddingClient.js';

export interface MatchResult {
  score: number;
  matchedTerms: string[];
}

interface Job {
  id: string;
  title: string;
  description: string | null;
}

interface TfIdfScore {
  score: number;
  matchedTerms: string[];
}

// Final score blend: 0.7 * semantic embedding + 0.3 * TF-IDF (must sum to 1).
// Embedding captures meaning; TF-IDF anchors on rare-skill keyword overlap.
const EMBEDDING_WEIGHT = 0.7;
const TFIDF_WEIGHT = 0.3;

// How many of the resume's top-weighted terms count as "high-signal" matches.
// A job term only ends up in `matchedTerms` if it's in this top slice.
const TOP_TERMS_FOR_MATCHING = 75;

// Hard cap on how many matched terms we store/display per job (UI tag list).
const MAX_MATCHED_TERMS = 15;

// Overlap bonus: small boost on top of cosine when many top terms match.
// Saturates at THRESHOLD matches, adding at most OVERLAP_BONUS_MAX to the score.
const OVERLAP_BONUS_THRESHOLD = 30;
const OVERLAP_BONUS_MAX = 0.2;

// Char caps before sending text to the embedding model — guards against
// token-limit overflows on the all-MiniLM-L6-v2 model (~512 tokens).
const RESUME_CHAR_CAP = 9000;
const JOB_DESCRIPTION_CHAR_CAP = 9000;

/** Dot product of two L2-normalised vectors == cosine similarity. */
function dotProduct(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

/** Lowercase boost keys and drop any non-positive weights. */
function normalizeBoosts(boosts: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(boosts)) {
    if (Number.isFinite(v) && v > 0) out[k.toLowerCase()] = v;
  }
  return out;
}

/** Build a TF-IDF index with the resume at position 0 and jobs at 1..N. */
function buildTfIdfIndex(resumeText: string, jobs: Job[]): any {
  const TfIdf = (natural as any).TfIdf;
  const index = new TfIdf();

  index.addDocument(extractTerms(resumeText));
  for (const job of jobs) {
    // Title gets double weight by repeating it.
    index.addDocument(extractTerms(`${job.title} ${job.title} ${job.description ?? ''}`));
  }
  return index;
}

/**
 * Extract the resume's TF-IDF term weights, applying user-defined boosts.
 * Boosted terms not present in the resume get injected at a baseline weight
 * so jobs mentioning them still get credit.
 */
function buildResumeTermWeights(
  tfidf: any,
  boosts: Record<string, number>,
): Map<string, number> {
  const weights = new Map<string, number>();

  tfidf.listTerms(0).forEach((t: { term: string; tfidf: number }) => {
    const boost = boosts[t.term] ?? 1;
    weights.set(t.term, t.tfidf * boost);
  });

  // Inject boosted terms missing from the resume at the median baseline weight.
  const sorted = [...weights.values()].sort((a, b) => a - b);
  const baseline = sorted[Math.floor(sorted.length / 2)] ?? 1;
  for (const [term, boost] of Object.entries(boosts)) {
    if (!weights.has(term)) weights.set(term, baseline * boost);
  }

  return weights;
}

/** Pull the N highest-weighted terms — used to filter matchedTerms to high-signal hits. */
function pickTopTerms(weights: Map<string, number>, n: number): Set<string> {
  const top = [...weights.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
  return new Set(top.map(([term]) => term));
}

/** Read a job's TF-IDF terms from the index at position `index + 1` (after the resume). */
function getJobTermWeights(tfidf: any, jobIndex: number): Map<string, number> {
  const weights = new Map<string, number>();
  tfidf.listTerms(jobIndex + 1).forEach((t: { term: string; tfidf: number }) => {
    weights.set(t.term, t.tfidf);
  });
  return weights;
}

/** Cosine similarity between resume and job term vectors, plus matched high-signal terms. */
function scoreJobAgainstResume(
  resumeWeights: Map<string, number>,
  topTerms: Set<string>,
  jobWeights: Map<string, number>,
): TfIdfScore {
  let dot = 0;
  let resumeNormSq = 0;
  let jobNormSq = 0;
  const matched = new Set<string>();

  for (const [term, w] of resumeWeights) {
    resumeNormSq += w * w;
    const jw = jobWeights.get(term);
    if (jw !== undefined) {
      dot += w * jw;
      if (topTerms.has(term)) matched.add(term);
    }
  }
  for (const w of jobWeights.values()) jobNormSq += w * w;

  const cosine = resumeNormSq > 0 && jobNormSq > 0
    ? dot / Math.sqrt(resumeNormSq * jobNormSq)
    : 0;
  const overlapBonus = Math.min(matched.size / OVERLAP_BONUS_THRESHOLD, 1) * OVERLAP_BONUS_MAX;
  const score = Math.min(cosine + overlapBonus, 1);

  return { score, matchedTerms: [...matched].slice(0, MAX_MATCHED_TERMS) };
}

/** Embedding cosine similarity between resume and each job. Returns 0s on failure. */
async function computeEmbeddingScores(resumeText: string, jobs: Job[]): Promise<number[]> {
  try {
    const resumeInput = resumeText.slice(0, RESUME_CHAR_CAP);
    const jobTexts = jobs.map(
      (j) => `${j.title}. ${(j.description ?? '').slice(0, JOB_DESCRIPTION_CHAR_CAP)}`,
    );
    const [resumeVec, ...jobVecs] = await embeddingClient.embed([resumeInput, ...jobTexts]);
    return jobVecs.map((vec) => Math.max(0, dotProduct(resumeVec, vec)));
  } catch (err) {
    console.error('[matcher] embedding failed, falling back to TF-IDF only:', err);
    return new Array(jobs.length).fill(0);
  }
}

/**
 * Score jobs against a resume using hybrid scoring:
 *   70% all-MiniLM-L6-v2 embedding cosine similarity
 *   30% TF-IDF cosine similarity + overlap bonus
 *
 * matchedTerms come from the TF-IDF side (high-signal skill terms).
 */
export async function scoreJobs(
  resumeText: string,
  jobs: Job[],
  termBoosts: Record<string, number> = {},
): Promise<Map<string, MatchResult>> {
  const results = new Map<string, MatchResult>();
  if (jobs.length === 0) return results;

  const boosts = normalizeBoosts(termBoosts);
  const tfidf = buildTfIdfIndex(resumeText, jobs);
  const resumeWeights = buildResumeTermWeights(tfidf, boosts);
  const topTerms = pickTopTerms(resumeWeights, TOP_TERMS_FOR_MATCHING);

  const tfidfScores = jobs.map((_, idx) => {
    const jobWeights = getJobTermWeights(tfidf, idx);
    return scoreJobAgainstResume(resumeWeights, topTerms, jobWeights);
  });

  const embeddingScores = await computeEmbeddingScores(resumeText, jobs);

  jobs.forEach((job, idx) => {
    const embSim = embeddingScores[idx] ?? 0;
    const { score: tfidfSim, matchedTerms } = tfidfScores[idx];
    const score = Math.min(EMBEDDING_WEIGHT * embSim + TFIDF_WEIGHT * tfidfSim, 1);
    results.set(job.id, { score, matchedTerms });
  });

  return results;
}
