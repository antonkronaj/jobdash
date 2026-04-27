function stripHtml(html) {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
export const themuse = async (params) => {
    const out = [];
    const seen = new Set();
    const locations = [];
    if (params.location)
        locations.push(params.location);
    if (params.includeRemote)
        locations.push('Flexible / Remote');
    const qs = new URLSearchParams({ page: '1', category: 'Software Engineering' });
    for (const loc of locations)
        qs.append('location', loc);
    const url = `https://www.themuse.com/api/public/jobs?${qs}`;
    try {
        const res = await fetch(url);
        if (!res.ok)
            throw new Error(`themuse ${res.status}`);
        const data = (await res.json());
        for (const j of data.results ?? []) {
            if (seen.has(j.id))
                continue;
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
    }
    catch (err) {
        console.error('[themuse]', err);
    }
    return out;
};
//# sourceMappingURL=themuse.js.map