'use client';

import Link from 'next/link';
import { NavigationLinks } from './NavigationLinks';
import { ScrambleText } from '../ScrambleText';
import type { PostMetadata } from '@/lib/posts';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Sunrise, Sun, Moon } from 'lucide-react';

interface SidebarProps {
  popularTags?: { tag: string; count: number }[];
  selectedTag?: string | null;
  onTagSelect?: (tag: string | null) => void;
  editorPosts?: PostMetadata[];
  onPostSelect?: (slug: string) => void;
  onNewPost?: () => void;
  useLinks?: boolean;
}

/**
 * Desktop sidebar navigation
 */
export function Sidebar({ selectedTag, onTagSelect, editorPosts, onPostSelect, onNewPost, useLinks }: SidebarProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const themes = ['dawn', 'day', 'night'];
  const currentIndex = themes.indexOf(theme || 'dawn');
  const nextTheme = themes[(currentIndex + 1) % themes.length];

  const getThemeIcon = () => {
    switch (theme) {
      case 'dawn':
        return <Sunrise className="w-5 h-5" strokeLinejoin="round" strokeLinecap="round" />;
      case 'day':
        return <Sun className="w-5 h-5" strokeLinejoin="round" strokeLinecap="round" />;
      case 'night':
        return <Moon className="w-5 h-5" strokeLinejoin="round" strokeLinecap="round" />;
      default:
        return <Sun className="w-5 h-5" strokeLinejoin="round" strokeLinecap="round" />;
    }
  };

  const getThemeName = () => {
    switch (theme) {
      case 'dawn':
        return 'Dawn';
      case 'day':
        return 'Day';
      case 'night':
        return 'Night';
      default:
        return 'Day';
    }
  };

  return (
    <aside className="hidden md:block md:col-span-2">
      <div className="sticky top-[200px] px-0 pt-0 pb-8 flex flex-col">
      <div className="mb-12">
        <Link
          href="/"
          className="text-white focus:outline-none flex flex-col items-start gap-3 mb-3"
          onClick={() => onTagSelect?.(null)}
        >
        </Link>
        <h1 className="text-2xl font-normal font-[family-name:var(--font-mondwest)]">
          <Link
            href="/"
            className="text-white focus:outline-none"
            onClick={() => onTagSelect?.(null)}
          >
            <ScrambleText text="Ani Dalal" />
          </Link>
        </h1>
      </div>

        <div className="flex-1">
          {editorPosts && onPostSelect ? (
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
                      className="text-xl text-white/50 hover:text-white transition-colors text-left w-full truncate block focus:outline-none"
                      title={post.title}
                    >
                      <ScrambleText text={post.title} />
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

        {mounted && (
          <button
            onClick={() => setTheme(nextTheme)}
            className="mt-8 flex items-center gap-2 text-white/50 hover:text-white transition-colors focus:outline-none group"
            aria-label={`Switch to ${nextTheme} mode`}
          >
            <span className="text-xl font-[family-name:var(--font-mondwest)]">
              <ScrambleText key={theme} text={getThemeName()} />
            </span>
            {getThemeIcon()}
          </button>
        )}
      </div>
    </aside>
  );
}
