import type { Metadata } from 'next';

export const SITE_URL = 'https://anidalal.com';
export const SITE_TITLE = 'Ani Dalal — Product Designer & Generative Artist';
export const SITE_DESCRIPTION = 'Ani Dalal is a product designer and generative artist in Bengaluru, designing AI creation tools at Frameo.AI and making interactive art, games and instruments.';
export const SOCIAL_PROFILES = [
  'https://x.com/dalal_ani',
  'https://www.instagram.com/67ani/',
  'https://www.linkedin.com/in/ani67/',
];
export const DEFAULT_IMAGE = 'https://res.cloudinary.com/duw0custw/image/upload/v1771154307/theend30_q3abo8.jpg';

export function pageMetadata(title: string, description: string, route: string, image = DEFAULT_IMAGE): Metadata {
  const url = new URL(route, SITE_URL).href;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'website', siteName: 'Ani Dalal', images: [{ url: image }] },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  };
}

export function jsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
