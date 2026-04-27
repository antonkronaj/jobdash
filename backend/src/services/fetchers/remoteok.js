function stripHtml(html) {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
export const remoteok = async (params) => {
    if (!params.includeRemote)
        return [];
    const url = 'https://remoteok.com/api';
    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': 'jobdash/0.1 (personal dashboard)' },
        });
        if (!res.ok)
            throw new Error(`remoteok ${res.status}`);
        const data = (await res.json());
        const jobs = data.filter((d) => {
            return typeof d === 'object' && d !== null && 'position' in d;
        });
        const terms = params.title.toLowerCase().split(/\s+/).filter(Boolean);
        const out = [];
        for (const j of jobs) {
            const title = j.position ?? '';
            const haystack = (title + ' ' + (j.tags ?? []).join(' ')).toLowerCase();
            if (!terms.every((t) => haystack.includes(t)))
                continue;
            const id = j.id ?? j.slug ?? title;
            const salary = j.salary_min || j.salary_max
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
    }
    catch (err) {
        console.error('[remoteok]', err);
        return [];
    }
};
//# sourceMappingURL=remoteok.js.map