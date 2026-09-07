/* eslint-disable @next/next/no-img-element -- Static project images use responsive Cloudinary URLs. */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BlogLayout } from '@/app/components/layout/BlogLayout';
import { getWorkProjects, projectImages, WORK_DETAILS } from '@/lib/work';
import { pageMetadata, jsonLd, SITE_URL } from '@/lib/seo';
import { cldUrl, cldSrcSet } from '@/lib/cloudinary';

export const dynamicParams = false;
export function generateStaticParams() { return getWorkProjects().map((entry) => ({ slug: entry.id })); }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = getWorkProjects().find((entry) => entry.id === slug);
  if (!entry) notFound();
  return pageMetadata(`${entry.title} — ${entry.medium || 'Selected Work'}`, entry.blurb || entry.title, `/work/${slug}/`, projectImages(slug)[0]?.src);
}

export default async function WorkPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = getWorkProjects().find((entry) => entry.id === slug);
  if (!entry) notFound();
  const images = projectImages(slug);
  return <BlogLayout>
    <article className="py-12 px-6 md:px-0 text-ink">
      <Link href="/work/" className="text-sm underline text-ink-muted">All selected projects</Link>
      <h1 className="mt-6 text-4xl font-[family-name:var(--font-mondwest)]">{entry.title}</h1>
      <p className="mt-3 text-ink-muted">{[entry.medium, entry.year].filter(Boolean).join(' · ')}</p>
      {entry.venue && <p className="mt-2 text-sm text-ink-subtle">{entry.venue}</p>}
      <p className="mt-6 text-xl leading-relaxed">{entry.blurb}</p>
      <div className="my-8 flex flex-wrap gap-5">
        <Link className="underline" href={`/?piece=${encodeURIComponent(slug)}`}>Explore in the fullscreen gallery</Link>
        {entry.href && <a className="underline" href={entry.href} target="_blank" rel="noopener noreferrer">{entry.hrefLabel || 'Open project'} ↗</a>}
      </div>
      {images[0] && <img className="w-full rounded-sm" src={cldUrl(images[0].src, 1200)} srcSet={cldSrcSet(images[0].src)} sizes="(max-width: 768px) 100vw, 800px" alt={images[0].alt} fetchPriority="high" />}
      {WORK_DETAILS[slug].map((section) => <section className="mt-10" key={section.heading}>
        <h2 className="text-2xl font-[family-name:var(--font-mondwest)]">{section.heading}</h2>
        <p className="mt-4 text-lg leading-relaxed text-ink-body">{section.text}</p>
      </section>)}
      {entry.controls?.length ? <section className="mt-10"><h2 className="text-2xl">Explore the work</h2><ul className="mt-4 space-y-2">{entry.controls.map((line) => <li key={line}>{line}</li>)}</ul></section> : null}
      {entry.caution && <p className="mt-5 text-ink-muted">{entry.caution}</p>}
      <div className="mt-10 space-y-6">{images.slice(1).map((image) => <img key={image.src} className="w-full rounded-sm" src={cldUrl(image.src, 1200)} srcSet={cldSrcSet(image.src)} sizes="(max-width: 768px) 100vw, 800px" alt={image.alt} loading="lazy" decoding="async" />)}</div>
      <p className="mt-12 text-ink-muted">A project by <Link href="/about/" className="underline">Ani Dalal</Link>.</p>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd({ '@context': 'https://schema.org', '@type': 'CreativeWork', name: entry.title, description: entry.blurb, url: `${SITE_URL}/work/${slug}/`, image: images.map((image) => image.src), creator: { '@type': 'Person', name: 'Ani Dalal', url: `${SITE_URL}/about/` } }) }} />
    </article>
  </BlogLayout>;
}
