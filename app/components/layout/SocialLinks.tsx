import { Instagram, Linkedin, Mail } from 'lucide-react';

/**
 * X's mark, drawn here rather than imported.
 *
 * Lucide dropped brand icons: its `X` is the close cross and its `Twitter` is
 * the retired bird, so neither is this. Filled rather than stroked, which is
 * how the mark is drawn — the others in this row are strokes, so it is set a
 * touch smaller to carry the same visual weight.
 */
function XMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

const LINKS = [
  { label: 'X', href: 'https://x.com/dalal_ani', icon: <XMark className="h-[18px] w-[18px]" /> },
  { label: 'Instagram', href: 'https://www.instagram.com/67ani/', icon: <Instagram className="h-5 w-5" strokeLinejoin="round" strokeLinecap="round" /> },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/ani67/', icon: <Linkedin className="h-5 w-5" strokeLinejoin="round" strokeLinecap="round" /> },
  { label: 'Email', href: 'mailto:anidalal3@gmail.com', icon: <Mail className="h-5 w-5" strokeLinejoin="round" strokeLinecap="round" /> },
];

/**
 * Where to find him, in the page's top-right corner beside the theme control.
 *
 * Muted at rest and only reaching full ink on hover, the same as the theme
 * button they sit next to — these are a way out of the page, not part of what
 * the page is saying, so they shouldn't compete with the work.
 */
export function SocialLinks() {
  return (
    <nav aria-label="Elsewhere" className="flex items-center">
      {LINKS.map(({ label, href, icon }) => (
        <a
          key={label}
          href={href}
          // mailto has nowhere to open, and the rel is meaningless for it
          {...(href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          aria-label={label}
          title={label}
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted transition-colors hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
        >
          {icon}
        </a>
      ))}
    </nav>
  );
}
