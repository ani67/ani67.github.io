import { Suspense } from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter, JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";
import Script from "next/script";
import "./globals.css";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: "Ani Dalal",
  url: "https://anidalal.com",
  email: "anidalal3@gmail.com",
  jobTitle: "Product Designer",
  description: "Product designer and artist with 8+ years of experience, currently building AI native tools for the future.",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Bengaluru",
    addressCountry: "IN",
  },
  sameAs: [],
  image: "https://res.cloudinary.com/duw0custw/image/upload/v1771154307/theend30_q3abo8.jpg",
};
import { ThemeProvider } from "./components/ThemeProvider";
import { ThemeTransition } from "./components/ThemeTransition";
import { PixelTransition } from "./components/PixelTransition";
import { Analytics } from "./components/Analytics";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const mondwest = localFont({
  src: '../public/fonts/PPMondwest-Regular.ttf',
  variable: "--font-mondwest",
});

const mori = localFont({
  src: '../public/fonts/PPMori-Book.woff',
  variable: "--font-mori",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://anidalal.com"),
  title: {
    default: "Ani Dalal",
    template: "%s | Ani Dalal",
  },
  description: "Product designer and artist with 8+ years of experience, currently building AI native tools for the future.",
  keywords: ["design", "portfolio", "generative art", "product design", "AI"],
  authors: [{ name: "Ani Dalal" }],
  openGraph: {
    title: "Ani Dalal",
    description: "Product designer and artist with 8+ years of experience, currently building AI native tools for the future.",
    url: "https://anidalal.com",
    siteName: "Ani Dalal",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "https://res.cloudinary.com/duw0custw/image/upload/v1771154307/theend30_q3abo8.jpg",
        width: 1200,
        height: 630,
        alt: "Ani Dalal",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Ani Dalal",
    description: "Product designer and artist with 8+ years of experience, currently building AI native tools for the future.",
    images: ["https://res.cloudinary.com/duw0custw/image/upload/v1771154307/theend30_q3abo8.jpg"],
  },
  alternates: {
    canonical: "https://anidalal.com",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <Script src="https://www.googletagmanager.com/gtag/js?id=G-5F61ZX6857" strategy="afterInteractive" />
      <Script id="google-analytics" strategy="afterInteractive">{`
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', 'G-5F61ZX6857');
      `}</Script>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${mondwest.variable} ${mori.variable} ${inter.variable} ${jetbrainsMono.variable} antialiased`}
      >
        {/* Global SVG definitions for squircle clip paths - 2% corner radius, matches home page */}
        <svg width="0" height="0" style={{ position: 'absolute' }}>
          <defs>
            <clipPath id="squircle-image" clipPathUnits="objectBoundingBox">
              <path
                d="M 0.96 0 c 0.01886 0 0.02828 0 0.03414 0.00586 a 0.02 0.02 0 0 1 0 0 c 0.00586 0.00586 0.00586 0.01529 0.00586 0.03414 L 1 0.96 c 0 0.01886 0 0.02828 -0.00586 0.03414 a 0.02 0.02 0 0 1 0 0 c -0.00586 0.00586 -0.01529 0.00586 -0.03414 0.00586 L 0.04 1 c -0.01886 0 -0.02828 0 -0.03414 -0.00586 a 0.02 0.02 0 0 1 0 0 c -0.00586 -0.00586 -0.00586 -0.01529 -0.00586 -0.03414 L 0 0.04 c 0 -0.01886 0 -0.02828 0.00586 -0.03414 a 0.02 0.02 0 0 1 0 0 c 0.00586 -0.00586 0.01529 -0.00586 0.03414 -0.00586 Z"
              />
            </clipPath>
          </defs>
        </svg>
        <ThemeProvider>
          <Analytics />
          <ThemeTransition />
          <Suspense><PixelTransition /></Suspense>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
