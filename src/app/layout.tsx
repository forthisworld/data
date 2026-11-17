import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eef1f4" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0f14" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Light by default; "dark" or "system" if the visitor chose it in the atlas's settings.
const THEME_SCRIPT = `try{var t=localStorage.getItem('ftw-theme');var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d)}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Apply the saved theme before first paint, so dark mode never flashes light. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}
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
