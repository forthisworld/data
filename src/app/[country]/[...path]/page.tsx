import { getCountryConfig, getOverview, getMapRegions } from '@/services/country.service';
import { getInfoRequestsByRegion, getAllInfoRequests } from '@/services/info-request.service';
import {
    resolvePath,
    getEntities,
    getPersons,
} from '@/services/entity.service';
import { getAllTollRoads, getTollRoadBySlug, getTollRoadsByRegion } from '@/services/toll-road.service';
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
                const [overview, allrequests, mapRegions] = await Promise.all([
                    getOverview(country),
                    getAllInfoRequests(country),
                    getMapRegions(country),
                ]);
                return <Dashboard config={config} overview={overview} infoRequests={allrequests} mapRegions={mapRegions} />;

            case 'region':
                const [regionOverview, regionRequests, regionRoads, people] = await Promise.all([
                    getOverview(country, [resolution.entity!.slug]),
                    getInfoRequestsByRegion(country, resolution.entity!.slug),
                    getTollRoadsByRegion(country, resolution.entity!.id),
                    getPersons(country),
                ]);

                return (
                    <RegionDashboard
                        config={config}
                        region={resolution.entity!}
                        overview={regionOverview}
                        countryCode={country}
                        infoRequests={regionRequests}
                        tollRoads={regionRoads.map(r => ({ slug: r.slug, name: r.name, tolling: r.tolling?.status }))}
                        people={people
                            .filter(p => p.regionId === resolution.entity!.id || p.regionIds?.includes(resolution.entity!.id))
                            .map(p => ({ slug: p.slug, name: p.name, role: p.role, description: p.description }))}
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
        // notFound() works by throwing; let it through rather than logging it as a failure.
        if ((error as { digest?: string })?.digest?.startsWith('NEXT_HTTP_ERROR_FALLBACK')) throw error;
        console.error('Error loading page data:', error);
        notFound();
    }
}
