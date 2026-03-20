import { ReactNode } from 'react';
import { MobileMenuController } from './MobileMenuController';
import { Sidebar } from './Sidebar';
import type { PostMetadata } from '@/lib/posts';

interface BlogLayoutProps {
  children: ReactNode;
  popularTags?: { tag: string; count: number }[];
  selectedTag?: string | null;
  onTagSelect?: (tag: string | null) => void;
  editorPosts?: PostMetadata[];
  onPostSelect?: (slug: string) => void;
  onNewPost?: () => void;
  useLinks?: boolean;
  rightSidebar?: ReactNode;
  navContent?: ReactNode;
  mobileNavContent?: ReactNode;
}

/**
 * Main blog layout with responsive navigation (server component)
 * Combines mobile header, mobile menu, and desktop sidebar
 */
export function BlogLayout({ children, popularTags, selectedTag, onTagSelect, editorPosts, onPostSelect, onNewPost, useLinks, rightSidebar, navContent, mobileNavContent }: BlogLayoutProps) {
  return (
    <div className="min-h-screen text-white relative z-10">
      {/* Skip to main content link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-white/10 focus:text-white focus:rounded focus:outline-none"
      >
        Skip to main content
      </a>

      <MobileMenuController
        showBackButton={useLinks}
        popularTags={popularTags}
        selectedTag={selectedTag}
        onTagSelect={onTagSelect}
        useLinks={!useLinks && !onTagSelect}
      />

      {/* Desktop Layout with max-width container and 12-column grid */}
      <div className="max-w-[1536px] mx-auto pt-0 md:pt-[200px] px-0 md:px-[20px] xl:px-[160px] pb-0 relative z-10">
        <div className="grid grid-cols-12 gap-4 md:gap-6">
          {/* Columns 1-2: Sidebar */}
          <Sidebar
            popularTags={popularTags}
            selectedTag={selectedTag}
            onTagSelect={onTagSelect}
            editorPosts={editorPosts}
            onPostSelect={onPostSelect}
            onNewPost={onNewPost}
            useLinks={useLinks}
            navContent={navContent}
          />

          {/* Column 3: Empty */}
          <div className="hidden md:block md:col-span-1"></div>

          {/* Columns 4-9: Content */}
          <div id="main-content" className="col-span-12 md:col-span-6">
            {children}
          </div>

          {/* Column 10: Empty */}
          <div className="hidden md:block md:col-span-1"></div>

          {/* Columns 11-12: Right Sidebar or Empty */}
          {rightSidebar ? (
            <div className="hidden md:block md:col-span-2">
              {rightSidebar}
            </div>
          ) : (
            <div className="hidden md:block md:col-span-2"></div>
          )}
        </div>
      </div>
    </div>
  );
}
