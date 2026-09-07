import Link from 'next/link';
import { BlogLayout } from '@/app/components/layout/BlogLayout';
import { getGallery } from '@/lib/gallery';
import { PROJECT_LINKS } from '@/lib/work-links';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata('Selected Projects — Design, Art & Browser Tools', 'Explore Ani Dalal’s product design, generative art, speculative cartography, browser games and musical instruments.', '/work/');

export default function WorkIndex() {
  const projects = getGallery().filter((entry) => !entry.hidden && PROJECT_LINKS[entry.id] && entry.id !== 'dashtoon-studio-features');
  return <BlogLayout><main className="px-6 py-12 md:px-0">
    <h1 className="text-4xl font-[family-name:var(--font-mondwest)]">Selected projects</h1>
    <p className="mt-5 text-xl text-ink-muted">AI creation tools, generative worlds, speculative maps and things to play in your browser.</p>
    <ul className="mt-10 space-y-10">{projects.map((entry) => <li key={entry.id}>
      <h2 className="text-2xl"><a className="underline" href={PROJECT_LINKS[entry.id]}>{entry.title}</a></h2>
      <p className="mt-2 text-sm text-ink-subtle">{entry.medium} · {entry.year}</p>
      <p className="mt-3 text-lg leading-relaxed text-ink-body">{entry.blurb}</p>
    </li>)}</ul>
    <p className="mt-12"><Link href="/" className="underline">Browse the full gallery</Link></p>
  </main></BlogLayout>;
}
