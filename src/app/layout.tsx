import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppNav } from "@/components/AppNav";
import { AppFooter } from "@/components/AppFooter";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { THEME_BOOT_SCRIPT } from "@/components/ThemeToggle";
import { getSession } from "@/lib/auth";
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
    icon: [
      { url: "/brand/veninspect-mark.png", type: "image/png", sizes: "256x256" },
      { url: "/icons/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icons/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#004825" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1117" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col text-[color:var(--ventia-ink)]">
        <AppNav
          userName={session?.name ?? null}
          isAdmin={session?.role === "ADMIN"}
        />
        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-5 pb-24 md:pb-8 xl:max-w-7xl 2xl:max-w-[96rem]">
          {children}
        </main>
        <AppFooter />
        <MobileBottomNav />
      </body>
    </html>
  );
}
