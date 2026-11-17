import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, EB_Garamond } from "next/font/google";
import "./globals.css";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import ServiceWorker from "@/components/ServiceWorker";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// The atlas's labels and headings: an old-book serif.
const atlasSerif = EB_Garamond({
  variable: "--font-atlas",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "data.ftw: an open atlas of public money",
    template: "%s | data.ftw",
  },
  description: "India's governance data on a map: toll roads, who built them, what they cost and what they earned, with every fact linked to its source. File RTIs, contribute data, or connect your AI assistant.",
  keywords: ["India", "government data", "RTI", "toll roads", "open data", "transparency", "atlas"],
  applicationName: "data.ftw",
  appleWebApp: { capable: true, title: "data.ftw", statusBarStyle: "default" },
  icons: {
    icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }, { url: "/icons/icon-192.png", sizes: "192x192" }],
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#1f3a4d",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${atlasSerif.variable} antialiased min-h-screen flex flex-col`}
        suppressHydrationWarning
      >
        <NavBar />
        <main className="flex-1">
          {children}
        </main>
        <Footer />
        <ServiceWorker />
      </body>
    </html>
  );
}
