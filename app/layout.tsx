import { Suspense } from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter, JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: "Ani Dalal",
  url: "https://anidalal.com",
  email: "anidalal3@gmail.com",
  jobTitle: "Product Designer",
  description: "Designer, artist and builder. Sets design direction and owns the product side of go-to-market at Frameo.AI.",
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
import { HEADLINE_TEXT } from "./components/layout/headline";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Two real cuts, so `font-bold` picks up the drawn bold rather than letting
// the browser synthesise one — on a bitmap face a synthesised weight smears
// the pixel edges that are the whole point of it.
const mondwest = localFont({
  src: [
    { path: '../public/fonts/PPMondwest-Regular.ttf', weight: '400', style: 'normal' },
    { path: '../public/fonts/PPMondwest-Bold.ttf', weight: '700', style: 'normal' },
  ],
  variable: "--font-mondwest",
});

// Three real cuts. `font-semibold` is what the labels ask for, so the browser
// gets a drawn weight instead of synthesising one — the same reason Mondwest
// carries its own bold.
const mori = localFont({
  src: [
    { path: '../public/fonts/PPMori-Book.woff', weight: '400', style: 'normal' },
    { path: '../public/fonts/PPMori-Semibold.woff', weight: '600', style: 'normal' },
    { path: '../public/fonts/PPMori-Black.woff', weight: '900', style: 'normal' },
  ],
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
  description: HEADLINE_TEXT,
  keywords: ["design", "portfolio", "generative art", "product design", "AI"],
  authors: [{ name: "Ani Dalal" }],
  openGraph: {
    title: "Ani Dalal",
    description: HEADLINE_TEXT,
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
    description: HEADLINE_TEXT,
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
        <script
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-5F61ZX6857"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-5F61ZX6857');
            `,
          }}
        />
      </head>
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
        {/* White cover visible instantly on load — PixelTransition removes it */}
        <div id="initial-cover" style={{ position: 'fixed', inset: 0, background: '#ffffff', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="128" height="146" viewBox="0 0 29 33" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0.0295923 25.4476L5.01568 32.5885C5.03465 32.6156 5.0657 32.6318 5.09884 32.6318H21.4079C21.4358 32.6318 21.4625 32.6203 21.4817 32.5999L25.9487 27.8569C25.9595 27.8454 25.9675 27.8316 25.972 27.8165L28.0887 20.7528C28.1124 20.6734 28.0361 20.6006 27.9579 20.628L26.3024 21.2085C26.2446 21.2288 26.1822 21.1936 26.1695 21.1337L24.7758 14.5136C24.7742 14.5058 24.7717 14.4983 24.7683 14.4911L21.5582 7.70339C21.5193 7.62115 21.4002 7.62774 21.3706 7.71376L20.3677 10.6292C20.3635 10.6414 20.357 10.6527 20.3486 10.6625L18.8929 12.3492C18.8389 12.4117 18.7369 12.387 18.7175 12.3068L17.186 5.96473C17.1834 5.95373 17.1789 5.94325 17.1728 5.93374L13.8924 0.824547C13.8448 0.750487 13.732 0.767987 13.7091 0.852971L12.0469 7.02504C12.0452 7.03125 12.043 7.03728 12.0401 7.04306L9.043 13.1984C9.01127 13.2635 8.92341 13.2753 8.87559 13.2209L5.4446 9.31335C5.39226 9.25374 5.29482 9.27459 5.27146 9.35041L2.96877 16.8249L0.0169016 25.3564C0.00628357 25.3871 0.0110015 25.421 0.0295923 25.4476Z" fill="url(#cover-grad)"/>
            <path d="M20.7422 24.9015L18.5054 32.6068H7.47753L6.59322 24.9015L9.9484 26.2998L11.9771 18.3564L15.0722 27.7873L20.7422 24.9015Z" fill="url(#cover-line)"/>
            <defs>
              <radialGradient id="cover-grad" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(10.168 37.1707) rotate(-73.9613) scale(40.657 30.1584)">
                <stop offset="0.159319" stopColor="#FF0000"/>
                <stop offset="0.718433" stopColor="#5F1090"/>
              </radialGradient>
              <linearGradient id="cover-line" x1="13.6677" y1="18.3564" x2="13.6677" y2="32.6068" gradientUnits="userSpaceOnUse">
                <stop stopColor="#FFF7A0"/>
                <stop offset="1" stopColor="white"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
        <ThemeProvider>
          {/* Reads the query string, so it needs its own boundary — without
              one it forces the whole tree client-side and /404 cannot
              prerender at all. */}
          <Suspense>
            <Analytics />
          </Suspense>
          <ThemeTransition />
          <Suspense><PixelTransition /></Suspense>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
