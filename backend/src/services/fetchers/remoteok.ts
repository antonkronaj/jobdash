import type { FetchedJob, FetchParams, Fetcher } from './types.js';

interface RemoteOkJob {
  id?: string;
  slug?: string;
  position?: string;
  company?: string;
  location?: string;
  tags?: string[];
  description?: string;
  url?: string;
  apply_url?: string;
  date?: string;
  salary_min?: number;
  salary_max?: number;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export const remoteok: Fetcher = async (params: FetchParams): Promise<FetchedJob[]> => {
  if (!params.includeRemote) return [];

  const url = 'https://remoteok.com/api';
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'jobdash/0.1 (personal dashboard)' },
    });
    if (!res.ok) throw new Error(`remoteok ${res.status}`);
    const data = (await res.json()) as unknown[];
    const jobs = data.filter((d: unknown): d is RemoteOkJob => {
      return typeof d === 'object' && d !== null && 'position' in d;
    });

    const terms = params.title.toLowerCase().split(/\s+/).filter(Boolean);

    const out: FetchedJob[] = [];
    for (const j of jobs) {
      const title = j.position ?? '';
      const haystack = (title + ' ' + (j.tags ?? []).join(' ')).toLowerCase();
      if (!terms.every((t) => haystack.includes(t))) continue;

      const id = j.id ?? j.slug ?? title;
      const salary =
        j.salary_min || j.salary_max
          ? `$${(j.salary_min ?? 0).toLocaleString()} – $${(j.salary_max ?? 0).toLocaleString()}`
          : null;

      out.push({
        source: 'remoteok',
        sourceId: String(id),
        title,
        company: j.company ?? null,
        location: j.location ?? 'Remote',
        remote: true,
        url: j.url ?? j.apply_url ?? '',
        description: stripHtml(j.description ?? ''),
        postedAt: j.date ?? null,
        salary,
      });
    }
    return out;
  } catch (err) {
    console.error('[remoteok]', err);
    return [];
  }
};
