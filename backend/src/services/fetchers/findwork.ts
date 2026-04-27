import type { FetchedJob, FetchParams, Fetcher } from './types.js';
import { getSetting } from '../../db.js';

interface FindworkJob {
  id: number;
  role: string;
  company_name?: string;
  location?: string;
  remote?: boolean;
  url?: string;
  text?: string;
  date_posted?: string;
  keywords?: string[];
}

interface FindworkResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: FindworkJob[];
}

const BASE = 'https://findwork.dev/api/jobs/';
const MAX_PAGES = 3;

export const findwork: Fetcher = async (params: FetchParams): Promise<FetchedJob[]> => {
  const apiKey = getSetting('findwork_api_key') || process.env.FINDWORK_API_KEY || '';
  if (!apiKey) return [];

  const headers = { Authorization: `Token ${apiKey}` };
  const out: FetchedJob[] = [];
  const seen = new Set<number>();

  async function paginate(extraParams: Record<string, string>) {
    const qs = new URLSearchParams({
      search: params.title,
      sort_by: 'relevance',
      ...extraParams,
    });
    let url: string | null = `${BASE}?${qs}`;
    let page = 0;

    while (url && page < MAX_PAGES) {
      if (page > 0) await new Promise(r => setTimeout(r, 1000));
      try {
        const res = await fetch(url, { headers });
        if (!res.ok) throw new Error(`findwork ${res.status}`);
        const data = (await res.json()) as FindworkResponse;
        for (const j of data.results ?? []) {
          if (seen.has(j.id)) continue;
          seen.add(j.id);
          out.push({
            source: 'findwork',
            sourceId: String(j.id),
            title: j.role,
            company: j.company_name ?? null,
            location: j.location ?? null,
            remote: j.remote ?? false,
            url: j.url ?? `https://findwork.dev/jobs/${j.id}`,
            description: j.text ?? '',
            postedAt: j.date_posted ?? null,
            salary: null,
          });
        }
        url = data.next;
        page++;
      } catch (err) {
        console.error('[findwork]', err);
        break;
      }
    }
  }

  if (params.includeRemote) await paginate({ remote: 'true' });
  if (params.location) await paginate({ location: params.location });

  return out;
};
