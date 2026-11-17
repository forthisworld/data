'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from './ui/input';
import { SearchResult } from '@/types';
import { Search, MapPin, User, Building, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GlobalSearchProps {
    countryCode: string;
    placeholder?: string;
    regionSlug?: string; // Optional: filter results to a specific region
    variant?: 'default' | 'header'; // Header variant for compact NavBar styling
}

const typeIcons: Record<string, React.ElementType> = {
    region: MapPin,
    person: User,
    infrastructure: Building,
};

const typeLabels: Record<string, string> = {
    region: 'Region',
    person: 'Person',
    infrastructure: 'Infrastructure',
};

export default function GlobalSearch({ countryCode, placeholder, regionSlug, variant = 'default' }: GlobalSearchProps) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const router = useRouter();
    const inputRef = useRef<HTMLInputElement>(null);
    const resultsRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const search = async () => {
            if (query.length < 2) {
                setResults([]);
                return;
            }

            setIsLoading(true);
            try {
                // Build search URL with optional region filter
                let url = `/api/search?country=${countryCode}&q=${encodeURIComponent(query)}`;
                if (regionSlug) {
                    url += `&region=${encodeURIComponent(regionSlug)}`;
                }

                const response = await fetch(url);
                if (response.ok) {
                    const data = await response.json();
                    setResults(data);
                }
            } catch (error) {
                console.error('Search error:', error);
            } finally {
                setIsLoading(false);
            }
        };

        const debounce = setTimeout(search, 300);
        return () => clearTimeout(debounce);
    }, [query, countryCode, regionSlug]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex((prev) => Math.max(prev - 1, -1));
        } else if (e.key === 'Enter' && selectedIndex >= 0) {
            e.preventDefault();
            handleSelect(results[selectedIndex]);
        } else if (e.key === 'Escape') {
            setIsOpen(false);
        }
    };

    const handleSelect = (result: SearchResult) => {
        setQuery('');
        setIsOpen(false);
        router.push(result.path);
    };

    // Group results by type
    const groupedResults = results.reduce((acc, result) => {
        if (!acc[result.type]) {
            acc[result.type] = [];
        }
        acc[result.type].push(result);
        return acc;
    }, {} as Record<string, SearchResult[]>);

    const isHeader = variant === 'header';

    return (
        <div className="relative w-full">
            <div className="relative">
                <Search className={cn(
                    "absolute left-4 top-1/2 -translate-y-1/2 text-slate-400",
                    isHeader ? "h-4 w-4 left-3" : "h-5 w-5"
                )} />
                <Input
                    ref={inputRef}
                    type="search"
                    placeholder={placeholder || 'Search states, cities, MPs, infrastructure...'}
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setIsOpen(true);
                        setSelectedIndex(-1);
                    }}
                    onFocus={() => setIsOpen(true)}
                    onBlur={() => setTimeout(() => setIsOpen(false), 200)}
                    onKeyDown={handleKeyDown}
                    className={cn(
                        "w-full transition-all",
                        isHeader
                            ? "pl-9 pr-3 py-2 text-sm bg-slate-100 border-slate-200 text-slate-900 placeholder:text-slate-500 rounded-lg focus:bg-white focus:border-blue-400"
                            : "pl-12 pr-4 py-6 text-lg bg-white/10 border-white/20 text-white placeholder:text-slate-400 rounded-xl focus:bg-white/15 focus:border-blue-400/50"
                    )}
                />
                {isLoading && (
                    <Loader2 className={cn(
                        "absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 animate-spin",
                        isHeader ? "h-4 w-4 right-3" : "h-5 w-5"
                    )} />
                )}
            </div>

            {/* Results Dropdown - z-[100] ensures it appears above all content */}
            {isOpen && results.length > 0 && (
                <div
                    ref={resultsRef}
                    className={cn(
                        "absolute top-full left-0 right-0 mt-2 border rounded-xl shadow-xl overflow-hidden z-[100]",
                        isHeader
                            ? "bg-white border-slate-200 max-h-80 overflow-y-auto"
                            : "bg-slate-800 border-slate-700 max-h-96 overflow-y-auto"
                    )}
                >
                    {Object.entries(groupedResults).map(([type, items]) => (
                        <div key={type}>
                            <div className={cn(
                                "px-4 py-2",
                                isHeader ? "bg-slate-100" : "bg-slate-700/50"
                            )}>
                                <span className={cn(
                                    "text-xs font-medium uppercase",
                                    isHeader ? "text-slate-500" : "text-slate-400"
                                )}>
                                    {typeLabels[type] || type}
                                </span>
                            </div>
                            {items.map((result) => {
                                const Icon = typeIcons[result.type] || Building;
                                const globalIndex = results.indexOf(result);
                                return (
                                    <button
                                        key={result.id}
                                        onClick={() => handleSelect(result)}
                                        className={cn(
                                            'w-full px-4 py-3 flex items-center gap-3 text-left transition-colors',
                                            isHeader
                                                ? cn(
                                                    "hover:bg-slate-100",
                                                    globalIndex === selectedIndex && 'bg-slate-100'
                                                )
                                                : cn(
                                                    "hover:bg-slate-700/50",
                                                    globalIndex === selectedIndex && 'bg-slate-700/50'
                                                )
                                        )}
                                    >
                                        <Icon className={cn(
                                            "h-5 w-5",
                                            isHeader ? "text-slate-400" : "text-slate-400"
                                        )} />
                                        <div className="flex-1 min-w-0">
                                            <p className={cn(
                                                "font-medium truncate",
                                                isHeader ? "text-slate-900" : "text-white"
                                            )}>{result.name}</p>
                                            {result.description && (
                                                <p className={cn(
                                                    "text-sm truncate",
                                                    isHeader ? "text-slate-500" : "text-slate-400"
                                                )}>{result.description}</p>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    ))}
                </div>
            )}

            {/* No results */}
            {isOpen && query.length >= 2 && !isLoading && results.length === 0 && (
                <div className={cn(
                    "absolute top-full left-0 right-0 mt-2 border rounded-xl shadow-xl p-4 text-center z-[100]",
                    isHeader
                        ? "bg-white border-slate-200"
                        : "bg-slate-800 border-slate-700"
                )}>
                    <p className={isHeader ? "text-slate-500" : "text-slate-400"}>
                        No results found for &quot;{query}&quot;
                    </p>
                </div>
            )}
        </div>
    );
}
