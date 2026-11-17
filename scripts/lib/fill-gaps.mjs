/**
 * Closes the gaps between seat shapes and the state they belong to.
 *
 * Seat files are drawn on other line-work than our state boundaries, so after clipping, strips of a
 * state along its border (and slivers between seats) belong to no seat. On the map a tap there finds
 * no seat. Every piece of a state that no seat covers is given to the seat OF THE SAME STATE it shares
 * the longest edge with. A piece that touches no seat goes to the state's seat if the state has exactly
 * one; otherwise it stays uncovered and is reported.
 *
 * `hold(key)` marks shapes that take part (so no neighbour grows into them) but never grow themselves:
 * areas the source draws without saying which seat they are.
 */
import mapshaper from 'mapshaper';

/**
 * @param {{ seats: GeoJSON.FeatureCollection, states: GeoJSON.FeatureCollection, hold?: (key: string) => boolean }} input
 *   seats: properties.key and properties.stateSlug; states: properties.slug.
 * @returns {Promise<{ seats: GeoJSON.FeatureCollection, filledKm2: number, left: { slug: string, km2: number }[] }>}
 *   seats: the same seats (all original properties), each with its gaps merged in.
 */
export async function fillGaps({ seats, states, hold = () => false }) {
    const props = new Map(seats.features.map(f => [f.properties.key, f.properties]));
    const strip = (fc, pick) => JSON.stringify({ type: 'FeatureCollection', features: fc.features.map(f => ({ type: 'Feature', properties: pick(f.properties), geometry: f.geometry })) });

    const cut = await mapshaper.applyCommands(
        [
            '-i seats.json name=seats -i states.json name=states',
            '-union target=seats,states fields=key,st,slug name=pieces',
            '-explode target=pieces',
            '-each target=pieces "km2 = this.area / 1e6"',
            '-o target=pieces pieces.json format=topojson no-quantization',
        ].join(' '),
        { 'seats.json': strip(seats, p => ({ key: p.key, st: p.stateSlug })), 'states.json': strip(states, p => ({ slug: p.slug })) },
    );
    const topo = JSON.parse(cut['pieces.json']);
    if (topo.transform) throw new Error('fill-gaps: expected unquantized TopoJSON');
    const pieces = Object.values(topo.objects)[0].geometries;

    // Length of every arc (degrees, with longitude scaled to the latitude), and which pieces use it.
    const arcLen = topo.arcs.map(arc => {
        let len = 0;
        for (let i = 1; i < arc.length; i++) {
            const k = Math.cos(((arc[i][1] + arc[i - 1][1]) / 2) * Math.PI / 180);
            len += Math.hypot((arc[i][0] - arc[i - 1][0]) * k, arc[i][1] - arc[i - 1][1]);
        }
        return len;
    });
    const users = topo.arcs.map(() => []);
    const arcsOf = pieces.map((g, i) => {
        const ids = (g.arcs ?? []).flat(g.type === 'MultiPolygon' ? 2 : 1).map(a => (a < 0 ? ~a : a));
        for (const a of ids) users[a].push(i);
        return ids;
    });

    const isGap = g => g.properties.key == null && g.properties.slug != null;
    let open = pieces.map((g, i) => i).filter(i => isGap(pieces[i]));
    let filledKm2 = 0;
    for (let changed = true; changed && open.length;) {
        changed = false;
        const given = [];
        for (const i of open) {
            const g = pieces[i];
            const score = new Map();
            for (const a of arcsOf[i]) {
                for (const j of users[a]) {
                    const n = pieces[j].properties;
                    if (j === i || n.key == null || n.st !== g.properties.slug || hold(n.key)) continue;
                    score.set(n.key, (score.get(n.key) ?? 0) + arcLen[a]);
                }
            }
            const best = [...score].sort((a, b) => b[1] - a[1])[0];
            if (best) given.push([i, best[0]]);
        }
        // Applied after the pass, so a pass only looks at seats and at gaps filled in earlier passes.
        for (const [i, key] of given) {
            pieces[i].properties.key = key;
            pieces[i].properties.st = pieces[i].properties.slug;
            filledKm2 += pieces[i].properties.km2;
            changed = true;
        }
        open = open.filter(i => isGap(pieces[i]));
    }
    // Islands and other pieces that touch no seat: clear only where the state has a single seat.
    const seatsIn = new Map();
    for (const p of props.values()) if (!hold(p.key)) seatsIn.set(p.stateSlug, [...(seatsIn.get(p.stateSlug) ?? []), p.key]);
    for (const i of open) {
        const only = seatsIn.get(pieces[i].properties.slug);
        if (only?.length !== 1) continue;
        pieces[i].properties.key = only[0];
        filledKm2 += pieces[i].properties.km2;
    }
    const left = open.filter(i => isGap(pieces[i])).map(i => ({ slug: pieces[i].properties.slug, km2: pieces[i].properties.km2 }));

    const merged = await mapshaper.applyCommands(
        '-i pieces.json -filter "key != null" -dissolve key -o seats.json format=geojson',
        { 'pieces.json': JSON.stringify(topo) },
    );
    const out = JSON.parse(merged['seats.json']);
    for (const f of out.features) f.properties = { ...props.get(f.properties.key) };
    return { seats: out, filledKm2, left };
}
