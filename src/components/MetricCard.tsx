'use client';

import { Metric, CountryConfig } from '@/types';
import { Card, CardContent } from './ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MetricCardProps {
    metric: Metric;
    config: CountryConfig;
    variant?: 'hero' | 'secondary' | 'compact';
}

function formatValue(value: number | string, currency?: string, unit?: string, config?: CountryConfig): string {
    if (typeof value === 'string') return value;

    // Format large numbers
    const formatter = new Intl.NumberFormat('en-IN', {
        maximumFractionDigits: 2,
        notation: value >= 1e9 ? 'compact' : 'standard',
    });

    let formatted = formatter.format(value);

    if (currency) {
        const symbol = currency === 'INR' ? '₹' : currency === 'USD' ? '$' : currency;
        formatted = `${symbol}${formatted}`;
    }

    if (unit) {
        formatted = `${formatted} ${unit}`;
    }

    return formatted;
}

export default function MetricCard({ metric, config, variant = 'secondary' }: MetricCardProps) {
    const TrendIcon = metric.trend === 'up' ? TrendingUp : metric.trend === 'down' ? TrendingDown : Minus;
    const trendColor = metric.trend === 'up' ? 'text-green-400' : metric.trend === 'down' ? 'text-red-400' : 'text-slate-400';

    if (variant === 'hero') {
        return (
            <Card className="bg-white/10 backdrop-blur-sm border-white/20 hover:bg-white/15 transition-all">
                <CardContent className="p-4 text-center">
                    <p className="text-3xl md:text-4xl font-bold text-white mb-1">
                        {formatValue(metric.value, metric.currency, metric.unit, config)}
                    </p>
                    <p className="text-sm text-slate-300">{metric.label}</p>
                    {metric.trend && (
                        <div className={cn('flex items-center justify-center gap-1 mt-1', trendColor)}>
                            <TrendIcon className="h-3 w-3" />
                            {metric.trendValue && <span className="text-xs">{metric.trendValue}%</span>}
                        </div>
                    )}
                </CardContent>
            </Card>
        );
    }

    if (variant === 'compact') {
        return (
            <div className="flex items-center justify-between p-2 bg-slate-800/30 rounded-lg">
                <span className="text-sm text-slate-400">{metric.label}</span>
                <span className="font-medium text-white">
                    {formatValue(metric.value, metric.currency, metric.unit, config)}
                </span>
            </div>
        );
    }

    return (
        <Card className="bg-slate-800/50 border-slate-700 hover:border-slate-600 transition-all">
            <CardContent className="p-4">
                <p className="text-sm text-slate-400 mb-1">{metric.label}</p>
                <p className="text-xl font-bold text-white">
                    {formatValue(metric.value, metric.currency, metric.unit, config)}
                </p>
                {metric.trend && (
                    <div className={cn('flex items-center gap-1 mt-1', trendColor)}>
                        <TrendIcon className="h-3 w-3" />
                        {metric.trendValue && <span className="text-xs">{metric.trendValue}%</span>}
                    </div>
                )}
                {metric.year && (
                    <p className="text-xs text-slate-500 mt-1">{metric.year}</p>
                )}
            </CardContent>
        </Card>
    );
}
