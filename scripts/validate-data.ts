/**
 * Validates the published record against data/SOURCING.md.
 *
 *   npm run data:validate
 *
 * Fails (exit 1) if any published fact lacks a source.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import type { Entity, Overview, TollRoad } from '../src/types';
import { validateRoad, validateEntity, validateOverview } from '../src/lib/data/validate';

export { validateRoad, validateEntity, validateOverview };

function walk(dir: string): string[] {
    return readdirSync(dir).flatMap(name => {
        const p = join(dir, name);
        if (name.startsWith('_')) return [];
        return statSync(p).isDirectory() ? walk(p) : name.endsWith('.json') ? [p] : [];
    });
}

function main(): void {
    const root = join(process.cwd(), 'data');
    let failed = 0;
    for (const country of readdirSync(root).filter(d => statSync(join(root, d)).isDirectory())) {
        for (const file of walk(join(root, country))) {
            const rel = relative(process.cwd(), file).replace(/\\/g, '/');
            const json = JSON.parse(readFileSync(file, 'utf-8'));
            let errors: string[] = [];
            if (rel.includes('/toll-roads/')) errors = validateRoad(json as TollRoad);
            else if (rel.endsWith('overview.json')) errors = validateOverview(json as Overview);
            else if (Array.isArray(json)) {
                json.forEach((e: Entity & Record<string, unknown>) =>
                    validateEntity(e).forEach(err => errors.push(`${e.id}: ${err}`)));
            } // config.json, info-requests.json: configuration and plans, not published facts
            if (errors.length) {
                failed++;
                console.error(`✗ ${rel}`);
                errors.forEach(e => console.error(`   - ${e}`));
            } else {
                console.log(`✓ ${rel}`);
            }
        }
    }
    if (failed) {
        console.error(`\n${failed} file(s) fail the sourcing standard (data/SOURCING.md).`);
        process.exit(1);
    }
}

if (process.argv[1] && /validate-data\.[tj]s$/.test(process.argv[1]) && existsSync('data')) main();
