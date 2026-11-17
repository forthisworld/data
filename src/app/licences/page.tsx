import Link from 'next/link';

export const metadata = {
    title: 'Licences and map credits',
    description: 'What you may do with data.ftw: code under MIT, data under the ODbL, and the credits for the map.',
};

const ROWS: { what: string; licence: string; href: string; note: string }[] = [
    { what: 'The published record (data/)', licence: 'Open Database License (ODbL) 1.0', href: 'https://opendatacommons.org/licenses/odbl/1-0/', note: 'Use it for anything, including commercial use, with credit to data.ftw (ForThisWorld). If you publish a changed copy of the database, it must also be under the ODbL.' },
    { what: 'The code', licence: 'MIT', href: 'https://github.com/forthisworld/data/blob/main/LICENSE', note: 'Use, copy and change it for any purpose, keeping the copyright notice.' },
    { what: 'State, district and national boundaries', licence: 'CC BY 2.5 India, CC BY 4.0', href: 'https://github.com/datameet/maps', note: 'From the DataMeet India community’s maps: 2011 Census districts grouped by today’s states. How they were built: /geo/in/ATTRIBUTION.md.' },
    { what: 'Roads drawn on the map', licence: 'ODbL 1.0, © OpenStreetMap contributors', href: 'https://www.openstreetmap.org/copyright', note: 'Each toll road is drawn from the OpenStreetMap ways listed in scripts/routes.json.' },
    { what: 'Streets, water and place names at city zoom', licence: 'ODbL 1.0, © OpenStreetMap contributors; tiles by OpenFreeMap (OpenMapTiles schema)', href: 'https://openfreemap.org', note: 'Loaded from OpenFreeMap’s servers. Their borders and country names are not drawn; only our boundary files draw borders.' },
    { what: 'Source documents', licence: 'Their publishers’ own terms', href: 'https://github.com/forthisworld/data/blob/main/data/SOURCING.md', note: 'We link to judgments, audits, gazettes, filings and reports; we do not relicense them.' },
    { what: 'Map software and fonts', licence: 'BSD-3-Clause (MapLibre GL JS), SIL OFL (Geist)', href: 'https://github.com/maplibre/maplibre-gl-js/blob/main/LICENSE.txt', note: '' },
];

export default function LicencesPage() {
    return (
        <div className="min-h-screen bg-ftw-bg text-ftw-text">
            <div className="container mx-auto max-w-3xl px-4 py-12">
                <p className="text-sm text-ftw-muted"><Link href="/in" className="hover:underline">← Back to the atlas</Link></p>
                <h1 className="mt-3 text-4xl font-semibold tracking-tight">Licences and map credits</h1>
                <p className="mt-3 text-ftw-muted">
                    data.ftw is meant to be reused. Credit it as <em>data.ftw (ForThisWorld)</em>, and credit the map sources below
                    when you reuse the map.
                </p>
                <div className="mt-8 divide-y divide-ftw-line rounded-2xl border border-ftw-line bg-ftw-surface">
                    {ROWS.map(r => (
                        <section key={r.what} className="p-5">
                            <h2 className="font-semibold">{r.what}</h2>
                            <p className="mt-0.5 text-sm"><a href={r.href} target="_blank" rel="noopener noreferrer" className="font-medium text-ftw-accent hover:underline">{r.licence}</a></p>
                            {r.note && <p className="mt-1.5 text-sm text-ftw-muted">{r.note}</p>}
                        </section>
                    ))}
                </div>
            </div>
        </div>
    );
}
