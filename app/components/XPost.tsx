'use client';

import Script from 'next/script';
import { useEffect, useRef, useState } from 'react';

type TwitterWindow = Window & {
  twttr?: { widgets: { createTweet: (id: string, target: HTMLElement, options: Record<string, unknown>) => Promise<HTMLElement | undefined> } };
};

/** The official X widget, with a permanent link when scripts are blocked. */
export function XPost({ id }: { id: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!ready || !container.current) return;
    const host = document.createElement('div');
    container.current.appendChild(host);
    (window as TwitterWindow).twttr?.widgets.createTweet(id, host, {
      conversation: 'none', theme: 'dark', dnt: true, align: 'center',
    }).catch(() => { /* The direct link remains usable. */ });
    return () => { host.remove(); };
  }, [id, ready]);

  return (
    <div className="not-prose my-8">
      <div ref={container} />
      <a className="text-sm underline text-ink-muted" href={`https://x.com/dalal_ani/status/${id}`} target="_blank" rel="noopener noreferrer">
        Watch the gameplay video on X ↗
      </a>
      <Script src="https://platform.twitter.com/widgets.js" strategy="afterInteractive" onReady={() => setReady(true)} />
    </div>
  );
}
