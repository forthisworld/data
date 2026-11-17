import { notFound } from 'next/navigation';
import { getCountryConfig, getAtlasData } from '@/services/country.service';
import AtlasLoader from '@/components/atlas/AtlasLoader';

interface CountryPageProps {
    params: Promise<{ country: string }>;
}

/** The country's home, and the app: the atlas. */
export default async function CountryPage({ params }: CountryPageProps) {
    const { country } = await params;
    let config;
    try {
        config = await getCountryConfig(country);
    } catch {
        notFound();
    }
    const data = await getAtlasData(country);
    return <AtlasLoader countryCode={country} countryName={config.name} data={data} />;
}

export async function generateStaticParams() {
    return [{ country: 'in' }];
}
