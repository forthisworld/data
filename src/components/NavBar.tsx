'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Shield } from 'lucide-react';
import GlobalSearch from './GlobalSearch';

const NavBar = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const pathname = usePathname();

  // Determine if we should show header search
  // Hide on pages that have their own search:
  // - Home page (/)
  // - Country dashboard (e.g., /in) - uses Dashboard.tsx with GlobalSearch
  // - Region pages (e.g., /in/maharashtra) - uses RegionDashboard.tsx with GlobalSearch
  // Show on all other pages (e.g., /contribute, /privacy, /in/info-requests, /in/person/xyz)
  const isHomePage = pathname === '/';
  const isCountryDashboard = /^\/[a-z]{2}$/.test(pathname);
  const isRegionPage = /^\/[a-z]{2}\/[a-z-]+$/.test(pathname) && !pathname.includes('/info-requests') && !pathname.includes('/person') && !pathname.includes('/infrastructure');
  const showHeaderSearch = !isHomePage && !isCountryDashboard && !isRegionPage;

  // Extract country code from path for global search
  const pathParts = pathname.split('/').filter(Boolean);
  const countryCode = pathParts.length > 0 && /^[a-z]{2}$/.test(pathParts[0]) ? pathParts[0] : 'in';

  return (
    <nav className="flex items-center justify-between p-4 bg-white shadow-md">
      <div className="flex items-center space-x-4">
        <Link href="/" className="text-2xl font-bold hover:opacity-80 transition-opacity">
          data.ftw
        </Link>
        {showHeaderSearch && (
          <div className="hidden md:block w-64">
            <GlobalSearch countryCode={countryCode} variant="header" placeholder="Global search..." />
          </div>
        )}
      </div>
      <div className="flex items-center space-x-2 md:space-x-4">
        <Link
          href="/privacy"
          className="hidden md:flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <Shield className="h-4 w-4" />
          Privacy
        </Link>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">Missing Data?</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Found Some Data Missing?</DialogTitle>
              <DialogDescription>
                Help us improve! You can contribute data or report missing information.
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-3 mt-4">
              <Button asChild className="flex-1" onClick={() => setDialogOpen(false)}>
                <Link href="/contribute">Contribute Data</Link>
              </Button>
              <Button asChild variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>
                <Link href="/contact">Contact Us</Link>
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </nav>
  );
};

export default NavBar;
