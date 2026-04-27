import { config } from '../../config.js';
async function searchAdzuna(query, where) {
    const { appId, appKey, country } = config.adzuna;
    if (!appId || !appKey)
        return [];
    const params = new URLSearchParams({
        app_id: appId,
        app_key: appKey,
        results_per_page: '50',
        what: query,
        'content-type': 'application/json',
    });
    if (where)
        params.set('where', where);
    const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?${params}`;
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Adzuna ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json());
    return data.results ?? [];
}
function formatSalary(j) {
    if (!j.salary_min && !j.salary_max)
        return null;
    const min = j.salary_min ? `$${Math.round(j.salary_min).toLocaleString()}` : '';
    const max = j.salary_max ? `$${Math.round(j.salary_max).toLocaleString()}` : '';
    return [min, max].filter(Boolean).join(' – ');
}
function isRemote(j) {
    const loc = j.location?.display_name?.toLowerCase() ?? '';
    const desc = j.description?.toLowerCase() ?? '';
    const title = j.title?.toLowerCase() ?? '';
    return /\bremote\b|work from home|wfh/.test(loc + ' ' + title + ' ' + desc);
}
export const adzuna = async (params) => {
    const queries = [{ where: params.location }];
    if (params.includeRemote)
        queries.push({ where: 'remote' });
    const seen = new Set();
    const out = [];
    for (const q of queries) {
        try {
            const results = await searchAdzuna(params.title, q.where);
            for (const j of results) {
                if (seen.has(j.id))
                    continue;
                seen.add(j.id);
                out.push({
                    source: 'adzuna',
                    sourceId: j.id,
                    title: j.title,
                    company: j.company?.display_name ?? null,
                    location: j.location?.display_name ?? null,
                    remote: isRemote(j),
                    url: j.redirect_url,
                    description: j.description ?? '',
                    postedAt: j.created ?? null,
                    salary: formatSalary(j),
                });
            }
        }
        catch (err) {
            console.error('[adzuna]', err);
        }
    }
    return out;
};
//# sourceMappingURL=adzuna.js.map