import natural from 'natural';
import { extractTerms } from './resumeParser.js';

export interface MatchResult {
  score: number;
  matchedTerms: string[];
}

/**
 * Score a job description against a resume using TF-IDF cosine similarity
 * plus a bonus for overlapping high-signal skill terms.
 */
export function scoreJobs(
  resumeText: string,
  jobs: Array<{ id: string; title: string; description: string }>,
): Map<string, MatchResult> {
  const TfIdf = (natural as any).TfIdf;
  const tfidf = new TfIdf();

  const resumeTokens = extractTerms(resumeText);
  tfidf.addDocument(resumeTokens);

  for (const job of jobs) {
    const tokens = extractTerms(`${job.title} ${job.title} ${job.description}`);
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

  const results = new Map<string, MatchResult>();
  jobs.forEach((job, idx) => {
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

    const cosine = resumeNormSq > 0 && jobNormSq > 0
      ? dot / Math.sqrt(resumeNormSq * jobNormSq)
      : 0;

    const overlapBonus = Math.min(matched.size / 30, 1) * 0.2;
    const score = Math.min(cosine + overlapBonus, 1);

    results.set(job.id, {
      score,
      matchedTerms: [...matched].slice(0, 15),
    });
  });

  return results;
}
