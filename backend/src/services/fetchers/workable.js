function stripHtml(html) {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
const BASE = 'https://jobs.workable.com/api/v1/jobs';
const PAGE_LIMIT = 20;
const MAX_PAGES = 3;
export const workable = async (params) => {
    const out = [];
    const seen = new Set();
    async function fetchPage(workplace, pageToken) {
        const qs = new URLSearchParams({ query: params.title, limit: String(PAGE_LIMIT) });
        if (workplace)
            qs.set('workplace', workplace);
        else if (params.location)
            qs.set('location', params.location);
        if (pageToken)
            qs.set('pageToken', pageToken);
        const res = await fetch(`${BASE}?${qs}`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' },
        });
        if (!res.ok)
            throw new Error(`workable ${res.status}`);
        return (await res.json());
    }
    async function paginate(workplace) {
        let pageToken;
        for (let page = 0; page < MAX_PAGES; page++) {
            try {
                const data = await fetchPage(workplace, pageToken);
                for (const j of data.jobs ?? []) {
                    if (seen.has(j.id))
                        continue;
                    seen.add(j.id);
                    const locStr = j.locations?.join(', ') ?? '';
                    const remote = j.workplace === 'remote';
                    out.push({
                        source: 'workable',
                        sourceId: j.id,
                        title: j.title,
                        company: j.company?.title ?? null,
                        location: locStr || null,
                        remote,
                        url: j.url,
                        description: stripHtml(j.description ?? ''),
                        postedAt: j.created ?? j.updated ?? null,
                        salary: null,
                    });
                }
                if (!data.nextPageToken)
                    break;
                pageToken = data.nextPageToken;
            }
            catch (err) {
                console.error('[workable]', err);
                break;
            }
        }
    }
    if (params.includeRemote)
        await paginate('remote');
    if (params.location)
        await paginate(null);
    return out;
};
//# sourceMappingURL=workable.js.map