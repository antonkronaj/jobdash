import type { FetchedJob, FetchParams, Fetcher } from './types.js';

interface MuseJob {
  id: number;
  name: string;
  contents: string;
  publication_date: string;
  locations: Array<{ name: string }>;
  company: { name: string };
  refs: { landing_page: string };
  categories?: Array<{ name: string }>;
}

interface MuseResponse {
  results: MuseJob[];
  page_count: number;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export const themuse: Fetcher = async (params: FetchParams): Promise<FetchedJob[]> => {
  const out: FetchedJob[] = [];
  const seen = new Set<number>();

  const locations: string[] = [];
  if (params.location) locations.push(params.location);
  if (params.includeRemote) locations.push('Flexible / Remote');

  const qs = new URLSearchParams({ page: '1', category: 'Software Engineering' });
  for (const loc of locations) qs.append('location', loc);

  const url = `https://www.themuse.com/api/public/jobs?${qs}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`themuse ${res.status}`);
    const data = (await res.json()) as MuseResponse;
    for (const j of data.results ?? []) {
      if (seen.has(j.id)) continue;
      seen.add(j.id);
      const locStr = j.locations?.map((l) => l.name).join(', ') ?? '';
      const remote = /flexible|remote/i.test(locStr);
      out.push({
        source: 'themuse',
        sourceId: String(j.id),
        title: j.name,
        company: j.company?.name ?? null,
        location: locStr || null,
        remote,
        url: j.refs?.landing_page ?? '',
        description: stripHtml(j.contents ?? ''),
        postedAt: j.publication_date ?? null,
        salary: null,
      });
    }
  } catch (err) {
    console.error('[themuse]', err);
  }

  return out;
};
