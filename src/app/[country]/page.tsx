import { getCountryConfig, getOverview, getMapRegions } from '@/services/country.service';
import { getAllInfoRequests } from '@/services/info-request.service';
import Dashboard from '@/components/Dashboard';
import { notFound } from 'next/navigation';

interface CountryPageProps {
    params: Promise<{
        country: string;
    }>;
}

export default async function CountryPage({ params }: CountryPageProps) {
    const { country } = await params;

    try {
        const [config, overview, infoRequests, mapRegions] = await Promise.all([
            getCountryConfig(country),
            getOverview(country),
            getAllInfoRequests(country),
            getMapRegions(country),
        ]);

        return <Dashboard config={config} overview={overview} infoRequests={infoRequests} mapRegions={mapRegions} />;
    } catch (error) {
        console.error('Error loading country data:', error);
        notFound();
    }
}

export async function generateStaticParams() {
    // Pre-render India
    return [{ country: 'in' }];
}
