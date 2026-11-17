import { getCountryConfig, getOverview } from '@/services/country.service';
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
        const [config, overview, infoRequests] = await Promise.all([
            getCountryConfig(country),
            getOverview(country),
            getAllInfoRequests(country),
        ]);

        return <Dashboard config={config} overview={overview} infoRequests={infoRequests} />;
    } catch (error) {
        console.error('Error loading country data:', error);
        notFound();
    }
}

export async function generateStaticParams() {
    // Pre-render India
    return [{ country: 'in' }];
}
