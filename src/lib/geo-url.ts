/**
 * The URL of a map file under public/geo, with a hash of its content as a query (?v=...).
 * Browsers and the service worker cache map files hard. The hash makes a rebuilt file a new URL,
 * so nobody is shown an old boundary file beside a new one.
 */
import { geoVersions } from './data/geo.generated';

/** geoUrl('in', 'ac/karnataka.geojson') → "/geo/in/ac/karnataka.geojson?v=1a2b3c4d5e" */
export function geoUrl(country: string, file: string): string {
    const v = geoVersions[`${country}/${file}`];
    return `/geo/${country}/${file}${v ? `?v=${v}` : ''}`;
}
