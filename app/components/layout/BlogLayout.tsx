import { ReactNode } from 'react';
import { MobileMenuController } from './MobileMenuController';
import { Sidebar } from './Sidebar';
import { SHELL_CONTAINER, SHELL_CONTAINER_FLUSH, SHELL_GRID, SHELL_CONTENT, SHELL_CONTENT_NARROW, SHELL_SPACER, SHELL_ASIDE } from './shell';
import { Masthead } from './Masthead';
import type { PostMetadata } from '@/lib/posts';

interface BlogLayoutProps {
  children: ReactNode;
  selectedTag?: string | null;
  onTagSelect?: (tag: string | null) => void;
  editorPosts?: PostMetadata[];
  onPostSelect?: (slug: string) => void;
  onNewPost?: () => void;
  useLinks?: boolean;
  rightSidebar?: ReactNode;
  navContent?: ReactNode;
  /** Headline for the masthead. Post pages carry their own title instead. */
  headline?: ReactNode;
  /** Row under the headline — the tag filter on /blog. */
  belowHeadline?: ReactNode;
}

/**
 * Main blog layout with responsive navigation (server component)
 * Combines mobile header, mobile menu, and desktop sidebar
 */
export function BlogLayout({ children, selectedTag, onTagSelect, editorPosts, onPostSelect, onNewPost, useLinks, rightSidebar, navContent, headline, belowHeadline }: BlogLayoutProps) {
  // The markdown editor is the one caller that still needs the old rail.
  const isEditor = Boolean(editorPosts);

  return (
    <div className="min-h-screen text-ink relative z-10">
      {/* Skip to main content link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-surface focus:text-ink focus:rounded focus:outline-none"
      >
        Skip to main content
      </a>

      {/* The editor keeps the old left rail — it lists posts to switch between,
          which the masthead has nowhere to put. Every reader-facing page uses
          the masthead instead, so /, /blog, /about and posts all open alike. */}
      {isEditor ? (
        <MobileMenuController
          showBackButton={useLinks}
          selectedTag={selectedTag}
          onTagSelect={onTagSelect}
          useLinks={!useLinks && !onTagSelect}
        />
      ) : (
        <Masthead headline={headline} below={belowHeadline} />
      )}

      {/* Desktop Layout with max-width container and 12-column grid.
          Geometry is shared with the gallery homepage — see `shell.ts`. */}
      {/* Flush under the masthead, which already took the top drop. The editor
          has no masthead, so it keeps the full container. */}
      <div className={isEditor ? SHELL_CONTAINER : SHELL_CONTAINER_FLUSH}>
        <div className={SHELL_GRID}>
          {isEditor ? (
            <Sidebar
              selectedTag={selectedTag}
              onTagSelect={onTagSelect}
              editorPosts={editorPosts}
              onPostSelect={onPostSelect}
              onNewPost={onNewPost}
              useLinks={useLinks}
              navContent={navContent}
            />
          ) : (
            <div className={SHELL_ASIDE}></div>
          )}

          {/* Column 3 is a gutter only for the editor; reader pages start the
              reading column here instead. */}
          {isEditor && <div className={SHELL_SPACER}></div>}

          {/* Columns 4-9: Content */}
          <div id="main-content" className={isEditor ? SHELL_CONTENT_NARROW : SHELL_CONTENT}>
            {children}
          </div>

          {/* Right margin: two columns on reader pages, one plus the editor
              panel when editing. */}
          {isEditor ? <div className={SHELL_SPACER}></div> : <div className={SHELL_ASIDE}></div>}

          {/* Columns 11-12: only the editor's panel claims them; reader pages
              give the width to the reading column instead. */}
          {isEditor && <div className={SHELL_ASIDE}>{rightSidebar}</div>}
        </div>
      </div>
    </div>
  );
}
