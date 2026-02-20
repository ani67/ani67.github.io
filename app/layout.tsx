import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import localFont from "next/font/local";
import Script from "next/script";
import "./globals.css";
import { ThemeProvider } from "./components/ThemeProvider";
import { ThemeTransition } from "./components/ThemeTransition";
import { PixelTransition } from "./components/PixelTransition";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const gambarino = localFont({
  src: '../public/fonts/Gambarino-Regular.woff2',
  variable: "--font-gambarino",
});

const mondwest = localFont({
  src: '../public/fonts/PPMondwest-Regular.ttf',
  variable: "--font-mondwest",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Blog & Portfolio",
    template: "%s | Blog & Portfolio",
  },
  description: "A blog and portfolio showcasing my work and thoughts.",
  keywords: ["blog", "portfolio", "web development"],
  authors: [{ name: "Your Name" }],
  openGraph: {
    title: "Blog & Portfolio",
    description: "A blog and portfolio showcasing my work and thoughts.",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Blog & Portfolio",
    description: "A blog and portfolio showcasing my work and thoughts.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <Script src="https://www.googletagmanager.com/gtag/js?id=G-5F61ZX6857" strategy="afterInteractive" />
      <Script id="google-analytics" strategy="afterInteractive">{`
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', 'G-5F61ZX6857');
      `}</Script>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${gambarino.variable} ${mondwest.variable} ${inter.variable} antialiased`}
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
          <ThemeTransition />
          <PixelTransition />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
