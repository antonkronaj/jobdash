import pdfParse from 'pdf-parse';
import natural from 'natural';

const STOPWORDS = new Set(
  (natural as any).stopwords as string[],
);
const EXTRA_STOPWORDS = new Set([
  'experience', 'work', 'team', 'company', 'role', 'looking', 'year', 'years',
  'including', 'using', 'used', 'ability', 'strong', 'good', 'excellent',
  'responsibilities', 'responsibility', 'required', 'requirements', 'preferred',
  'skills', 'skill', 'knowledge', 'working', 'within', 'across', 'etc',
]);

export async function parseResumePdf(buffer: Buffer): Promise<string> {
  const result = await pdfParse(buffer);
  return result.text;
}

export function extractTerms(text: string): string[] {
  const normalized = text
    .toLowerCase()
    .replace(/[^a-z0-9+#.\-\s]/g, ' ')
    .replace(/\s+/g, ' ');

  const tokens = normalized.split(' ').filter(Boolean);
  return tokens.filter((t) => {
    if (t.length < 2) return false;
    if (STOPWORDS.has(t) || EXTRA_STOPWORDS.has(t)) return false;
    if (/^\d+$/.test(t)) return false;
    return true;
  });
}
