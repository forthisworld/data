/**
 * Country Service
 * 
 * Business logic for country-related operations.
 * Provides clean API for accessing country configs and overviews.
 */

import { countryRepository, regionRepository } from '@/lib/repositories';
import { CountryConfig, Overview } from '@/types';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Load a JSON file from data/<countryCode>/ as an offline fallback
 * when MongoDB is unavailable.
 */
async function readLocalJson<T>(countryCode: string, relativePath: string): Promise<T | null> {
    try {
        const filePath = path.join(process.cwd(), 'data', countryCode, relativePath);
        const content = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(content) as T;
    } catch {
        return null;
    }
}

/**
 * Get country configuration
 * @param countryCode - ISO country code (e.g., 'in' for India)
 */
export async function getCountryConfig(countryCode: string): Promise<CountryConfig> {
    let config: CountryConfig | null = null;
    try {
        config = await countryRepository.getConfig(countryCode);
    } catch {
        // MongoDB unavailable - fall back to local JSON
    }

    if (!config) {
        config = await readLocalJson<CountryConfig>(countryCode, 'config.json');
    }

    if (!config) {
        throw new Error(`Country configuration not found for: ${countryCode}`);
    }

    return config;
}

/**
 * Get overview data for a country or region
 * @param countryCode - ISO country code
 * @param regionPath - Optional path segments to a region
 */
export async function getOverview(countryCode: string, regionPath?: string[]): Promise<Overview> {
    // If region path is provided, get region overview
    if (regionPath && regionPath.length > 0) {
        const regionSlug = regionPath[regionPath.length - 1];
        let overview: Overview | null = null;
        try {
            overview = await regionRepository.getOverview(countryCode, regionSlug);
        } catch {
            // MongoDB unavailable - fall back to local JSON below
        }

        if (!overview) {
            overview = await readLocalJson<Overview>(countryCode, `regions/${regionSlug}/overview.json`);
        }

        if (!overview) {
            // Fallback: try to construct overview from region data
            const region = await regionRepository.findBySlug(countryCode, regionSlug);
            if (region) {
                return {
                    entityId: region.id,
                    entityType: 'region',
                    name: region.name,
                    metrics: [],
                    highlights: [],
                    quickLinks: [],
                };
            }
            throw new Error(`Region overview not found: ${regionPath.join('/')}`);
        }

        return overview;
    }

    // Get country overview
    let overview: Overview | null = null;
    try {
        overview = await countryRepository.getOverview(countryCode);
    } catch {
        // MongoDB unavailable - fall back to local JSON
    }

    if (!overview) {
        overview = await readLocalJson<Overview>(countryCode, 'overview.json');
    }

    if (!overview) {
        throw new Error(`Country overview not found for: ${countryCode}`);
    }

    return overview;
}

/**
 * Check if a country is supported
 */
export async function isCountrySupported(countryCode: string): Promise<boolean> {
    try {
        const config = await countryRepository.getConfig(countryCode);
        return config !== null;
    } catch {
        return false;
    }
}
