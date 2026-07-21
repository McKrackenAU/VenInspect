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
    icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/icon.svg" }],
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
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 pb-24 md:pb-8">
          {children}
        </main>
        <AppFooter />
        <MobileBottomNav />
      </body>
    </html>
  );
}
