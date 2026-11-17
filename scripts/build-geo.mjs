/**
 * Builds the map boundaries in public/geo/in/ from DataMeet's open boundary
 * data, pinned to one commit so the output is reproducible.
 *
 *   npm run geo:build
 *
 * Every layer is cut from ONE topology (the Census 2011 district polygons),
 * simplified once, so a border shared by two layers is the same line in both:
 *
 *   districts.geojson  640 Census 2011 districts         { name, state, stateSlug, census2011Code }
 *   states.geojson     36 current states and UTs         { name, slug }
 *                      = the districts dissolved by their current state
 *   india.geojson      national outline                  { name: 'India' }
 *                      = all of it dissolved
 *   labels.geojson     one interior point per state and per district
 *                      { name, kind: 'state' | 'district', stateSlug, areaKm2, census2011Code (districts) }
 *
 * Districts are the 2011 boundaries: districts created since 2011 are not
 * shown separately. Each district is assigned to its CURRENT state by
 * location, using DataMeet's current state polygons (so Hyderabad sits in
 * Telangana, Leh in Ladakh). Those state polygons are used for nothing else,
 * with one exception:
 *
 * The district file has a 641st polygon, "Data Not Available" (census code 0):
 * the part of the former state of Jammu & Kashmir where the Census was not
 * taken, mostly the area under Pakistani administration (it is not Aksai Chin,
 * which the file puts inside Leh). It is inside the official boundary, so it is kept in the states and the national outline but is not a
 * district. It straddles today's Jammu & Kashmir and Ladakh, so it is cut in
 * two along the current state line (the only line here that does not come from
 * the district file).
 *
 * Licences and caveats: see public/geo/in/ATTRIBUTION.md.
 */
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import mapshaper from 'mapshaper';

const COMMIT = 'b3fbbde595310b397a55d718e0958ce249a4fa1f'; // datameet/maps master, 2022-05-11
const BASE = `https://raw.githubusercontent.com/datameet/maps/${COMMIT}`;
const FILES = [
    ...['shp', 'dbf', 'shx', 'prj'].map(e => `States/Admin2.${e}`),
    ...['shp', 'dbf', 'shx', 'prj'].map(e => `Districts/Census_2011/2011_Dist.${e}`),
];
const OUT = join(process.cwd(), 'public', 'geo', 'in');
// Share of points kept. Set by size: the four files together stay near 1.5 MB (7% is over 1.6 MB).
const SIMPLIFY = '6.5%';

// A piece of the split "Data Not Available" polygon smaller than this is a
// sliver from the two sources' lines not quite agreeing; it goes to the other state.
const SLIVER_KM2 = 100;

const slugify = s =>
    s.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const work = mkdtempSync(join(tmpdir(), 'ftw-geo-'));
const tmp = mkdtempSync(join(tmpdir(), 'ftw-geo-tmp-'));
try {
    for (const f of FILES) {
        const res = await fetch(`${BASE}/${f}`);
        if (!res.ok) throw new Error(`${res.status} fetching ${f}`);
        writeFileSync(join(work, f.split('/').pop()), Buffer.from(await res.arrayBuffer()));
        console.log(`[geo] fetched ${f}`);
    }
    mkdirSync(OUT, { recursive: true });
    const w = p => join(work, p).replace(/\\/g, '/');
    const t = p => join(tmp, p).replace(/\\/g, '/');
    const o = p => join(OUT, p).replace(/\\/g, '/');

    // 1. Give every district polygon its current state; cut the no-census
    //    polygon along the current Jammu & Kashmir / Ladakh line.
    await mapshaper.runCommands(
        `-i "${w('2011_Dist.shp')}" name=d -i "${w('Admin2.shp')}" name=s ` +
        `-join target=d source=s point-method fields=ST_NM prefix=cur_ ` +
        // Lakshadweep's islands miss the state polygon; its name is the same in both files.
        `-each target=d "state = cur_ST_NM || ST_NM, code = String(censuscode), name = DISTRICT" ` +
        `-filter-fields target=d name,state,code ` +
        `-filter target=s "ST_NM == 'Ladakh'" ` +
        `-filter target=d "code == '0'" + name=nodata ` +
        `-filter target=d "code != '0'" ` +
        `-clip target=nodata source=s + name=nodata_ladakh ` +
        `-erase target=nodata source=s name=nodata_jk ` +
        `-explode target=nodata_ladakh ` +
        `-each target=nodata_ladakh "state = this.area / 1e6 < ${SLIVER_KM2} ? 'Jammu & Kashmir' : 'Ladakh'" ` +
        `-explode target=nodata_jk ` +
        `-each target=nodata_jk "state = this.area / 1e6 < ${SLIVER_KM2} ? 'Ladakh' : 'Jammu & Kashmir'" ` +
        `-o target=d "${t('districts.geojson')}" format=geojson ` +
        `-o target=nodata_ladakh "${t('nodata_ladakh.geojson')}" format=geojson ` +
        `-o target=nodata_jk "${t('nodata_jk.geojson')}" format=geojson ` +
        `-o target=s "${t('ladakh.geojson')}" format=geojson`
    );
    await mapshaper.runCommands(
        `-i "${w('Admin2.shp')}" -each "slug = (${slugify.toString()})(ST_NM)" -o "${t('admin2.json')}" format=json`
    );
    const admin2 = JSON.parse(readFileSync(t('admin2.json'), 'utf-8'));

    // 2. One topology, simplified once; every layer is derived from it.
    await mapshaper.runCommands(
        `-i "${t('districts.geojson')}" "${t('nodata_ladakh.geojson')}" "${t('nodata_jk.geojson')}" combine-files ` +
        `-merge-layers force name=all ` +
        `-clean ` +
        `-simplify ${SIMPLIFY} keep-shapes ` +
        `-each "stateSlug = (${slugify.toString()})(state)" ` +
        `-dissolve stateSlug copy-fields=state + name=states ` +
        `-each target=states "name = state, slug = stateSlug, areaKm2 = Math.round(this.area / 1e6)" ` +
        `-dissolve target=all + name=india ` +
        `-each target=india "name = 'India'" ` +
        `-filter target=all "code != '0'" name=districts ` +
        `-each target=districts "census2011Code = code, areaKm2 = Math.round(this.area / 1e6)" ` +
        `-points target=states inner + name=state_labels ` +
        `-each target=state_labels "kind = 'state', stateSlug = slug" ` +
        `-filter-fields target=state_labels name,kind,stateSlug,areaKm2 ` +
        `-points target=districts inner + name=district_labels ` +
        `-each target=district_labels "kind = 'district'" ` +
        `-filter-fields target=district_labels name,kind,stateSlug,census2011Code,areaKm2 ` +
        `-merge-layers target=state_labels,district_labels force name=labels ` +
        `-filter-fields target=districts name,state,stateSlug,census2011Code ` +
        `-filter-fields target=states name,slug ` +
        `-o target=india "${o('india.geojson')}" format=geojson precision=0.001 ` +
        `-o target=states "${o('states.geojson')}" format=geojson precision=0.001 ` +
        `-o target=districts "${o('districts.geojson')}" format=geojson precision=0.001 ` +
        `-o target=labels "${o('labels.geojson')}" format=geojson precision=0.001`
    );

    // 3. Check the result before anyone relies on it.
    const read = f => JSON.parse(readFileSync(join(OUT, f), 'utf-8')).features;
    const [india, states, districts, labels] =
        ['india.geojson', 'states.geojson', 'districts.geojson', 'labels.geojson'].map(read);
    const fail = msg => { throw new Error(`[geo] ${msg}`); };
    if (india.length !== 1) fail(`india: ${india.length} features, expected 1`);
    if (states.length !== 36) fail(`states: ${states.length} features, expected 36`);
    if (districts.length !== 640) fail(`districts: ${districts.length} features, expected 640`);
    if (labels.length !== 676) fail(`labels: ${labels.length} features, expected 676`);
    const want = admin2.map(s => `${s.slug}|${s.ST_NM}`).sort().join('\n');
    const got = states.map(s => `${s.properties.slug}|${s.properties.name}`).sort().join('\n');
    if (want !== got) fail(`states differ from the current list of 36:\n${got}`);
    const slugs = new Set(states.map(s => s.properties.slug));
    const bad = districts.filter(d => !d.properties.state || !slugs.has(d.properties.stateSlug));
    if (bad.length) fail(`districts without a current state: ${bad.map(d => d.properties.name).join(', ')}`);
    if (new Set(districts.map(d => d.properties.census2011Code)).size !== 640) fail('census2011Code is not unique');
    // Unset fields come out of the merge as null; labels for states have no district code.
    for (const l of labels) if (l.properties.census2011Code == null) delete l.properties.census2011Code;
    writeFileSync(join(OUT, 'labels.geojson'), JSON.stringify({ type: 'FeatureCollection', features: labels }).replace(/\},\{"type":"Feature"/g, '},\n{"type":"Feature"'));

    let total = 0;
    for (const f of ['india.geojson', 'states.geojson', 'districts.geojson', 'labels.geojson']) {
        const kb = readFileSync(join(OUT, f)).length / 1024;
        total += kb;
        console.log(`[geo] ${f}: ${read(f).length} features, ${kb.toFixed(0)} KB`);
    }
    console.log(`[geo] total ${total.toFixed(0)} KB (simplified to ${SIMPLIFY})`);
} finally {
    rmSync(work, { recursive: true, force: true });
    rmSync(tmp, { recursive: true, force: true });
}
