import { notFound } from 'next/navigation';
import { getCountryConfig, getAtlasRegions } from '@/services/country.service';
import AtlasLoader from '@/components/atlas/AtlasLoader';

interface CountryPageProps {
    params: Promise<{ country: string }>;
}

/** The country's home: the atlas. */
export default async function CountryPage({ params }: CountryPageProps) {
    const { country } = await params;
    let config;
    try {
        config = await getCountryConfig(country);
    } catch {
        notFound();
    }
    const regions = await getAtlasRegions(country);
    return <AtlasLoader countryCode={country} countryName={config.name} regions={regions} />;
}

export async function generateStaticParams() {
    return [{ country: 'in' }];
}
