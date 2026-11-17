
import { promises as fs } from 'fs';
import path from 'path';
import { InfoRequest, InfoRequestConfig, InfoRequestTarget, InfoRequestStats } from '@/types';

interface InfoRequestData {
    config: InfoRequestConfig;
    requests: InfoRequest[];
    targets: InfoRequestTarget[];
    stats: InfoRequestStats;
}

/**
 * Get all info request data for a country
 */
export async function getInfoRequestData(countryCode: string): Promise<InfoRequestData | null> {
    try {
        const dataPath = path.join(process.cwd(), 'data', countryCode, 'info-requests.json');
        const data = await fs.readFile(dataPath, 'utf-8');
        return JSON.parse(data) as InfoRequestData;
    } catch (error) {
        console.error('Error loading info request data:', error);
        return null;
    }
}

/**
 * Get info requests filtered by region
 */
export async function getInfoRequestsByRegion(countryCode: string, regionSlug: string): Promise<InfoRequest[]> {
    const data = await getInfoRequestData(countryCode);
    if (!data || !data.config.enabled) return [];

    return data.requests.filter(req => {
        // filter by regionIds if available
        if (req.regionIds && req.regionIds.includes(regionSlug)) return true;

        // fallback to tags
        if (req.tags && req.tags.includes(regionSlug)) return true;

        return false;
    });
}

/**
 * Get all info requests
 */
export async function getAllInfoRequests(countryCode: string): Promise<InfoRequest[]> {
    const data = await getInfoRequestData(countryCode);
    if (!data || !data.config.enabled) return [];
    return data.requests;
}
