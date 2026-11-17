import { getCountryConfig, getOverview } from '@/services/country.service';
import { getInfoRequestsByRegion, getAllInfoRequests } from '@/services/info-request.service';
import {
    resolvePath,
    getEntities,
} from '@/services/entity.service';
import { getAllTollRoads, getTollRoadBySlug } from '@/services/toll-road.service';
import Dashboard from '@/components/Dashboard';
import EntityList from '@/components/EntityList';
import EntityDetail from '@/components/EntityDetail';
import RegionDashboard from '@/components/RegionDashboard';
import CategoryView from '@/components/CategoryView';
import TollRoadList from '@/components/TollRoadList';
import TollRoadDetail from '@/components/TollRoadDetail';
import { notFound } from 'next/navigation';

interface CatchAllPageProps {
    params: Promise<{
        country: string;
        path: string[];
    }>;
}

export default async function CatchAllPage({ params }: CatchAllPageProps) {
    const { country, path } = await params;

    try {
        const config = await getCountryConfig(country);
        const resolution = await resolvePath(country, path);

        switch (resolution.type) {
            case 'dashboard':
                const [overview, allrequests] = await Promise.all([
                    getOverview(country),
                    getAllInfoRequests(country)
                ]);
                return <Dashboard config={config} overview={overview} infoRequests={allrequests} />;

            case 'region':
                const [regionOverview, regionRequests] = await Promise.all([
                    getOverview(country, [resolution.entity!.slug]),
                    getInfoRequestsByRegion(country, resolution.entity!.slug)
                ]);

                return (
                    <RegionDashboard
                        config={config}
                        region={resolution.entity!}
                        overview={regionOverview}
                        countryCode={country}
                        infoRequests={regionRequests}
                    />
                );

            case 'person':
                return (
                    <EntityDetail
                        config={config}
                        entity={resolution.entity!}
                        countryCode={country}
                    />
                );

            case 'infrastructure':
                return (
                    <EntityDetail
                        config={config}
                        entity={resolution.entity!}
                        countryCode={country}
                    />
                );

            case 'toll_roads_list': {
                const tollRoads = await getAllTollRoads(country);
                return <TollRoadList config={config} tollRoads={tollRoads} countryCode={country} />;
            }

            case 'toll_road': {
                const tollRoad = await getTollRoadBySlug(country, resolution.tollRoadSlug!);
                if (!tollRoad) notFound();
                const relatedRequests = await getAllInfoRequests(country);
                return (
                    <TollRoadDetail
                        config={config}
                        tollRoad={tollRoad}
                        countryCode={country}
                        infoRequests={relatedRequests}
                    />
                );
            }

            case 'category':
                if (resolution.category === 'region') {
                    const regions = await getEntities(country, 'region', resolution.filters);
                    return (
                        <EntityList
                            config={config}
                            entities={regions}
                            category="region"
                            countryCode={country}
                        />
                    );
                }
                if (resolution.category === 'person') {
                    const persons = await getEntities(country, 'person', resolution.filters);
                    return (
                        <EntityList
                            config={config}
                            entities={persons}
                            category="person"
                            countryCode={country}
                        />
                    );
                }
                if (resolution.category === 'infrastructure') {
                    const infra = await getEntities(country, 'infrastructure', resolution.filters);
                    return (
                        <EntityList
                            config={config}
                            entities={infra}
                            category="infrastructure"
                            countryCode={country}
                        />
                    );
                }
                // Infrastructure subcategory
                const infraByCategory = await getEntities(country, 'infrastructure', {
                    category: resolution.category as never,
                    ...resolution.filters,
                });
                return (
                    <CategoryView
                        config={config}
                        category={resolution.category!}
                        entities={infraByCategory}
                        countryCode={country}
                    />
                );

            case 'not_found':
            default:
                notFound();
        }
    } catch (error) {
        console.error('Error loading page data:', error);
        notFound();
    }
}
