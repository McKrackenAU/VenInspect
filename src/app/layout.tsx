import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppNav } from "@/components/AppNav";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VenInspect",
  description: "Simple field inspections for bridges, drainage, and noise walls",
  applicationName: "VenInspect",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "VenInspect",
  },
  formatDetection: {
    telephone: false,
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/icon.svg" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#004825",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col text-[color:var(--ventia-ink)]">
        <AppNav />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 pb-24 md:pb-8">
          {children}
        </main>
        <MobileBottomNav />
      </body>
    </html>
  );
}
