'use client';

import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';

interface BreadcrumbItem {
    label: string;
    href?: string;
}

interface BreadcrumbNavProps {
    items: BreadcrumbItem[];
}

export default function BreadcrumbNav({ items }: BreadcrumbNavProps) {
    return (
        <nav className="flex items-center text-sm">
            <Link
                href="/"
                className="text-slate-400 hover:text-white transition-colors"
            >
                <Home className="h-4 w-4" />
            </Link>

            {items.map((item, index) => (
                <div key={index} className="flex items-center">
                    <ChevronRight className="h-4 w-4 text-slate-600 mx-2" />
                    {item.href ? (
                        <Link
                            href={item.href}
                            className="text-slate-400 hover:text-white transition-colors"
                        >
                            {item.label}
                        </Link>
                    ) : (
                        <span className="text-white font-medium">{item.label}</span>
                    )}
                </div>
            ))}
        </nav>
    );
}
