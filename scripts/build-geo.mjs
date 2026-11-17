/**
 * Builds the map boundaries in public/geo/in/ from DataMeet's open boundary
 * data, pinned to one commit so the output is reproducible.
 *
 *   npm run geo:build
 *
 * Output (simplified GeoJSON, committed to the repo):
 *   india.geojson      national outline, Survey of India boundary
 *   states.geojson     36 current states and UTs        { name, slug }
 *   districts.geojson  640 Census 2011 districts         { name, state, stateSlug, census2011Code }
 *
 * Districts are the 2011 boundaries: districts created since 2011 are not
 * shown separately. Each district is assigned to its CURRENT state by
 * location (so e.g. Hyderabad sits in Telangana, Leh in Ladakh).
 *
 * Licences: see public/geo/in/ATTRIBUTION.md.
 */
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import mapshaper from 'mapshaper';

const COMMIT = 'b3fbbde595310b397a55d718e0958ce249a4fa1f'; // datameet/maps master, 2022-05-11
const BASE = `https://raw.githubusercontent.com/datameet/maps/${COMMIT}`;
const FILES = [
    'Country/india-soi.geojson',
    ...['shp', 'dbf', 'shx', 'prj'].map(e => `States/Admin2.${e}`),
    ...['shp', 'dbf', 'shx', 'prj'].map(e => `Districts/Census_2011/2011_Dist.${e}`),
];
const OUT = join(process.cwd(), 'public', 'geo', 'in');

const slugify = s =>
    s.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const work = mkdtempSync(join(tmpdir(), 'ftw-geo-'));
try {
    for (const f of FILES) {
        const res = await fetch(`${BASE}/${f}`);
        if (!res.ok) throw new Error(`${res.status} fetching ${f}`);
        writeFileSync(join(work, f.split('/').pop()), Buffer.from(await res.arrayBuffer()));
        console.log(`[geo] fetched ${f}`);
    }
    mkdirSync(OUT, { recursive: true });
    const w = p => join(work, p).replace(/\\/g, '/');
    const o = p => join(OUT, p).replace(/\\/g, '/');

    // National outline (Survey of India boundary)
    await mapshaper.runCommands(
        `-i "${w('india-soi.geojson')}" -simplify 6% keep-shapes -each "name='India'" -filter-fields name -o "${o('india.geojson')}" format=geojson precision=0.001`
    );

    // States and UTs (current)
    await mapshaper.runCommands(
        `-i "${w('Admin2.shp')}" -simplify 2.5% keep-shapes ` +
        `-each "name=ST_NM, slug=(${slugify.toString()})(ST_NM)" -filter-fields name,slug ` +
        `-o "${o('states.geojson')}" format=geojson precision=0.001`
    );

    // Districts (2011 boundaries), joined to their current state by location
    await mapshaper.runCommands(
        `-i "${w('2011_Dist.shp')}" name=districts -i "${w('Admin2.shp')}" name=states ` +
        `-join target=districts source=states point-method fields=ST_NM prefix=cur_ ` +
        `-target districts -filter "censuscode != 0" -simplify 6% keep-shapes ` +
        `-each "name=DISTRICT, state=cur_ST_NM || ST_NM, stateSlug=(${slugify.toString()})(cur_ST_NM || ST_NM), census2011Code=String(censuscode)" ` +
        `-filter-fields name,state,stateSlug,census2011Code ` +
        `-o "${o('districts.geojson')}" format=geojson precision=0.001`
    );

    for (const f of ['india.geojson', 'states.geojson', 'districts.geojson']) {
        const n = JSON.parse(readFileSync(join(OUT, f), 'utf-8')).features.length;
        console.log(`[geo] ${f}: ${n} features, ${(readFileSync(join(OUT, f)).length / 1024).toFixed(0)} KB`);
    }
} finally {
    rmSync(work, { recursive: true, force: true });
}
