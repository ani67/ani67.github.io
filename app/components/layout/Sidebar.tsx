import Link from 'next/link';
import { ReactNode } from 'react';
import { NavigationLinks } from './NavigationLinks';
import { ScrambleText } from '../ScrambleText';

import type { PostMetadata } from '@/lib/posts';

interface SidebarProps {
  popularTags?: { tag: string; count: number }[];
  selectedTag?: string | null;
  onTagSelect?: (tag: string | null) => void;
  editorPosts?: PostMetadata[];
  onPostSelect?: (slug: string) => void;
  onNewPost?: () => void;
  useLinks?: boolean;
  navContent?: ReactNode;
}

/**
 * Desktop sidebar navigation (server component)
 */
export function Sidebar({ selectedTag, onTagSelect, editorPosts, onPostSelect, onNewPost, useLinks, navContent }: SidebarProps) {
  return (
    <aside className="hidden md:block md:col-span-2">
      <div className="sticky top-[200px] px-0 pt-0 pb-8 flex flex-col">
      <div className="mb-12">
        <Link
          href="/"
          className="text-white focus:outline-none flex flex-col items-start gap-3 mb-3"
        >
        </Link>
        <h1 className="text-2xl font-normal font-[family-name:var(--font-mondwest)]">
          <Link
            href="/"
            className="text-white focus:outline-none"
          >
            <ScrambleText text="Ani Dalal" />
          </Link>
        </h1>
      </div>

        <div className="flex-1">
          {navContent ? (
            navContent
          ) : editorPosts && onPostSelect ? (
            <nav>
              <ul className="space-y-0">
                {onNewPost && (
                  <li>
                    <button
                      onClick={onNewPost}
                      className="text-xl text-white hover:text-white transition-colors text-left w-full truncate block focus:outline-none mb-4"
                    >
                      <ScrambleText text="+ New Post" />
                    </button>
                  </li>
                )}
                {editorPosts.map((post) => (
                  <li key={post.slug}>
                    <button
                      onClick={() => onPostSelect(post.slug)}
                      className={`text-xl transition-colors text-left w-full truncate block focus:outline-none ${
                        post.published === false
                          ? 'text-white/30 italic hover:text-white/60'
                          : 'text-white/50 hover:text-white'
                      }`}
                      title={post.title}
                    >
                      <ScrambleText text={post.published === false ? `${post.title} — draft` : post.title} />
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          ) : onTagSelect || useLinks ? (
            <NavigationLinks
              selectedTag={selectedTag ?? null}
              onTagSelect={onTagSelect}
              useLinks={useLinks}
            />
          ) : null}
        </div>
      </div>
    </aside>
  );
}
