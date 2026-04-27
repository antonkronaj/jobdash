import { config } from '../../config.js';
const BASE = 'https://findwork.dev/api/jobs/';
const MAX_PAGES = 3;
export const findwork = async (params) => {
    if (!config.findwork.apiKey)
        return [];
    const headers = { Authorization: `Token ${config.findwork.apiKey}` };
    const out = [];
    const seen = new Set();
    async function paginate(extraParams) {
        const qs = new URLSearchParams({
            search: params.title,
            sort_by: 'relevance',
            ...extraParams,
        });
        let url = `${BASE}?${qs}`;
        let page = 0;
        while (url && page < MAX_PAGES) {
            if (page > 0)
                await new Promise(r => setTimeout(r, 1000));
            try {
                const res = await fetch(url, { headers });
                if (!res.ok)
                    throw new Error(`findwork ${res.status}`);
                const data = (await res.json());
                for (const j of data.results ?? []) {
                    if (seen.has(j.id))
                        continue;
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
            }
            catch (err) {
                console.error('[findwork]', err);
                break;
            }
        }
    }
    if (params.includeRemote)
        await paginate({ remote: 'true' });
    if (params.location)
        await paginate({ location: params.location });
    return out;
};
//# sourceMappingURL=findwork.js.map