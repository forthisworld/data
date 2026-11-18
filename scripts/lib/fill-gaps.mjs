/**
 * Closes the gaps between seat shapes and the state they belong to.
 *
 * Seat files are drawn on other line-work than our state boundaries, so after clipping, strips of a
 * state along its border (and slivers between seats) belong to no seat. On the map a tap there finds
 * no seat. Every piece of a state that no seat covers is given to the seat OF THE SAME STATE it shares
 * the longest edge with. A piece that touches no seat (an island, or an exclave of the state) goes to
 * the nearest seat of the same state, and is reported so the choice can be checked. Only a state with
 * no seats at all stays uncovered.
 *
 * `assign` names the seat for a piece where the rules above pick the wrong one: a point inside the piece,
 * and the seat's key. Each entry must match exactly one uncovered piece, so a stale entry fails the build.
 *
 * `hold(key)` marks shapes that take part (so no neighbour grows into them) but never grow themselves:
 * areas the source draws without saying which seat they are.
 */
import mapshaper from 'mapshaper';

/**
 * @param {{ seats: GeoJSON.FeatureCollection, states: GeoJSON.FeatureCollection, hold?: (key: string) => boolean, assign?: { at: number[], key: string }[] }} input
 *   seats: properties.key and properties.stateSlug; states: properties.slug.
 * @returns {Promise<{ seats: GeoJSON.FeatureCollection, filledKm2: number, apart: { slug: string, km2: number, at: number[], key: string, km: number }[], left: { slug: string, km2: number, at: number[] }[] }>}
 *   seats: the same seats (all original properties), each with its gaps merged in.
 *   apart: pieces that touched no seat, with the seat each went to and how far away it is.
 *   left: pieces still in no seat (their state has none).
 */
export async function fillGaps({ seats, states, hold = () => false, assign = [] }) {
    const props = new Map(seats.features.map(f => [f.properties.key, f.properties]));
    const strip = (fc, pick) => JSON.stringify({ type: 'FeatureCollection', features: fc.features.map(f => ({ type: 'Feature', properties: pick(f.properties), geometry: f.geometry })) });

    const cut = await mapshaper.applyCommands(
        [
            '-i seats.json name=seats -i states.json name=states',
            '-union target=seats,states fields=key,st,slug name=pieces',
            '-explode target=pieces',
            '-each target=pieces "km2 = this.area / 1e6, cx = this.centroidX, cy = this.centroidY, ix = this.innerX, iy = this.innerY"',
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

    // Pieces whose seat is named outright.
    const ringOf = refs => refs.flatMap(a => (a < 0 ? [...topo.arcs[~a]].reverse() : topo.arcs[a]));
    const inRing = ([px, py], ring) => {
        let inside = false;
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            const [xi, yi] = ring[i], [xj, yj] = ring[j];
            if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
        }
        return inside;
    };
    const holds = (g, pt) => (g.type === 'MultiPolygon' ? g.arcs : [g.arcs]).some(poly => inRing(pt, ringOf(poly[0])) && !poly.slice(1).some(h => inRing(pt, ringOf(h))));
    if (process.env.GAP_DEBUG) for (const i of open) { const p = pieces[i].properties; if (p.km2 > 3 && assign.some(f => Math.hypot(f.at[0] - p.cx, f.at[1] - p.cy) < 0.5)) console.log('gap', p.slug, p.km2.toFixed(1), 'centroid', p.cx.toFixed(3), p.cy.toFixed(3), 'inner', p.ix.toFixed(3), p.iy.toFixed(3)); }
    for (const fix of assign) {
        if (!props.has(fix.key)) throw new Error(`fill-gaps: no seat ${fix.key}`);
        const hit = open.filter(i => holds(pieces[i], fix.at));
        if (hit.length !== 1) throw new Error(`fill-gaps: ${hit.length} uncovered pieces at ${fix.at} (expected 1) for ${fix.key}`);
        pieces[hit[0]].properties.key = fix.key;
        pieces[hit[0]].properties.st = pieces[hit[0]].properties.slug;
        filledKm2 += pieces[hit[0]].properties.km2;
    }
    open = open.filter(i => isGap(pieces[i]));
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
    // Islands and exclaves, which touch no seat: the nearest seat of the same state (edge to edge).
    const points = i => arcsOf[i].flatMap(a => topo.arcs[a]);
    const seatPieces = new Map();
    pieces.forEach((g, i) => {
        const p = g.properties;
        if (p.key != null && p.st != null && !hold(p.key)) seatPieces.set(p.st, [...(seatPieces.get(p.st) ?? []), i]);
    });
    const where = i => ({ slug: pieces[i].properties.slug, km2: pieces[i].properties.km2, at: [pieces[i].properties.cx, pieces[i].properties.cy] });
    const apart = [];
    for (const i of open) {
        const mine = points(i);
        const k = Math.cos(pieces[i].properties.cy * Math.PI / 180);
        let best = null;
        for (const j of seatPieces.get(pieces[i].properties.slug) ?? []) {
            for (const [x, y] of points(j)) {
                for (const [mx, my] of mine) {
                    const d = Math.hypot((x - mx) * k, y - my);
                    if (!best || d < best.d) best = { d, key: pieces[j].properties.key };
                }
            }
        }
        if (!best) continue;
        apart.push({ ...where(i), key: best.key, km: best.d * 111.2, piece: i });
        filledKm2 += pieces[i].properties.km2;
    }
    // Applied after the search, so a piece is never measured against another island.
    for (const a of apart) { pieces[a.piece].properties.key = a.key; delete a.piece; }
    const left = open.filter(i => isGap(pieces[i])).map(where);

    const merged = await mapshaper.applyCommands(
        '-i pieces.json -filter "key != null" -dissolve key -o seats.json format=geojson',
        { 'pieces.json': JSON.stringify(topo) },
    );
    const out = JSON.parse(merged['seats.json']);
    for (const f of out.features) f.properties = { ...props.get(f.properties.key) };
    return { seats: out, filledKm2, apart, left };
}
