import natural from 'natural';
import { extractTerms } from './resumeParser.js';
import { pipeline, env } from '@huggingface/transformers';

// Cache model in ~/.cache/huggingface (default); disable local model check
env.allowLocalModels = false;

export interface MatchResult {
  score: number;
  matchedTerms: string[];
}

// Lazy singleton — loads once on first call (~25 MB quantized ONNX download)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _embedder: any = null;

async function getEmbedder(): Promise<any> {
  if (!_embedder) {
    _embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
      dtype: 'q8',
    });
  }
  return _embedder;
}

/** Mean-pool the token embeddings and L2-normalise the result. */
async function embed(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const embedder = await getEmbedder();
  const output = await (embedder as any)(texts, { pooling: 'mean', normalize: true });
  // output.tolist() → number[][]
  return (output as any).tolist() as number[][];
}

/** Dot product of two L2-normalised vectors == cosine similarity. */
function dotProduct(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
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
  jobs: Array<{ id: string; title: string; description: string | null }>,
): Promise<Map<string, MatchResult>> {
  const results = new Map<string, MatchResult>();
  if (jobs.length === 0) return results;

  // ── TF-IDF half ─────────────────────────────────────────────────────────────
  const TfIdf = (natural as any).TfIdf;
  const tfidf = new TfIdf();

  const resumeTokens = extractTerms(resumeText);
  tfidf.addDocument(resumeTokens);

  for (const job of jobs) {
    const tokens = extractTerms(`${job.title} ${job.title} ${job.description ?? ''}`);
    tfidf.addDocument(tokens);
  }

  const resumeTermWeights = new Map<string, number>();
  tfidf.listTerms(0).forEach((t: { term: string; tfidf: number }) => {
    resumeTermWeights.set(t.term, t.tfidf);
  });

  const topResumeTerms = [...resumeTermWeights.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 60)
    .map(([term]) => term);

  // Compute TF-IDF cosine + overlap bonus per job
  const tfidfScores: Array<{ cosine: number; matchedTerms: string[] }> = jobs.map((job, idx) => {
    const jobTerms = new Map<string, number>();
    tfidf.listTerms(idx + 1).forEach((t: { term: string; tfidf: number }) => {
      jobTerms.set(t.term, t.tfidf);
    });

    let dot = 0;
    let resumeNormSq = 0;
    let jobNormSq = 0;
    const matched = new Set<string>();

    for (const [term, w] of resumeTermWeights) {
      resumeNormSq += w * w;
      const jw = jobTerms.get(term);
      if (jw !== undefined) {
        dot += w * jw;
        if (topResumeTerms.includes(term)) matched.add(term);
      }
    }
    for (const w of jobTerms.values()) jobNormSq += w * w;

    const cosine =
      resumeNormSq > 0 && jobNormSq > 0
        ? dot / Math.sqrt(resumeNormSq * jobNormSq)
        : 0;

    const overlapBonus = Math.min(matched.size / 30, 1) * 0.2;
    const tfidfScore = Math.min(cosine + overlapBonus, 1);

    return { cosine: tfidfScore, matchedTerms: [...matched].slice(0, 15) };
  });

  // ── Embedding half ───────────────────────────────────────────────────────────
  let embeddingScores: number[] = new Array(jobs.length).fill(0);
  try {
    const resumeInput = resumeText.slice(0, 4000); // cap to avoid token overflow
    const jobTexts = jobs.map(
      (j) => `${j.title}. ${(j.description ?? '').slice(0, 800)}`,
    );

    const [resumeVecs, ...jobVecs] = await embed([resumeInput, ...jobTexts]);
    embeddingScores = jobVecs.map((vec) => Math.max(0, dotProduct(resumeVecs, vec)));
  } catch (err) {
    console.error('[matcher] embedding failed, falling back to TF-IDF only:', err);
  }

  // ── Blend & store ────────────────────────────────────────────────────────────
  jobs.forEach((job, idx) => {
    const embSim = embeddingScores[idx] ?? 0;
    const { cosine: tfidfSim, matchedTerms } = tfidfScores[idx];
    const score = Math.min(0.7 * embSim + 0.3 * tfidfSim, 1);
    results.set(job.id, { score, matchedTerms });
  });

  return results;
}
