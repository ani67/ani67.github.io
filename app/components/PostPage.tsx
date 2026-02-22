import { format, parseISO, isValid } from 'date-fns';
import { MDXRemote } from 'next-mdx-remote/rsc';
import type { Post } from '@/lib/posts';
import { BlogLayout } from './layout/BlogLayout';

interface PostPageProps {
  post: Post;
  popularTags: { tag: string; count: number }[];
}

// Custom image component with caption support
function MDXImage({ src, alt, title }: { src?: string; alt?: string; title?: string }) {
  if (!src) return null;

  if (title) {
    // Image with caption - hanging in margin
    return (
      <div className="image-with-caption">
        <img src={src} alt={alt || ''} />
        <div className="caption-text">{title}</div>
      </div>
    );
  }

  // Regular image
  return <img src={src} alt={alt || ''} />;
}

// Custom video component
function MDXVideo({ src, controls, style, ...props }: any) {
  if (!src) return null;
  // Ignore style prop - let CSS handle the width
  return <video src={src} controls={controls !== false} />;
}

// Custom div component to handle video-with-caption divs
function MDXDiv({ className, children, ...props }: any) {
  if (className === 'video-with-caption') {
    return (
      <div className="video-with-caption" {...props}>
        {children}
      </div>
    );
  }
  if (className === 'caption-text') {
    return (
      <div className="caption-text" {...props}>
        {children}
      </div>
    );
  }
  return <div className={className} {...props}>{children}</div>;
}

// Custom link component - open in new tab
function MDXLink({ href, children, ...props }: any) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
      {children}
    </a>
  );
}

const components = {
  img: MDXImage,
  video: MDXVideo,
  div: MDXDiv,
  a: MDXLink,
};

/**
 * Post page component for displaying individual blog posts
 */
export default function PostPageClient({ post, popularTags }: PostPageProps) {
  // Validate and format date
  const postDate = parseISO(post.date);
  const formattedDate = isValid(postDate)
    ? format(postDate, 'MMMM d, yyyy')
    : 'Invalid date';

  return (
    <BlogLayout
      popularTags={popularTags}
      useLinks
    >
      {/* Main Content - Responsive */}
      <article className="flex-1 px-6 pt-24 pb-24 md:px-0 md:pt-0 md:pb-32">
          <header className="mb-8 lg:mb-12">
            <h1 className="text-3xl lg:text-5xl font-normal leading-snug font-[family-name:var(--font-mondwest)]">
              {post.title}
            </h1>
            <p className="mt-4 lg:mt-6 text-xl lg:text-2xl text-white/50">{post.description}</p>
          </header>

          <div className="prose prose-lg lg:prose-2xl dark:prose-invert max-w-none prose-headings:font-normal prose-headings:text-white prose-headings:leading-tight prose-headings:mt-8 prose-headings:mb-4 prose-p:text-white/90 prose-p:mb-6 prose-a:text-white prose-a:underline hover:prose-a:text-white prose-strong:text-white prose-code:text-white/90 prose-code:bg-white/10 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-white/10 prose-pre:border prose-pre:border-white/30 prose-ul:text-white/90 prose-ol:text-white/90 prose-li:text-white/90 prose-li:marker:text-white/90 prose-blockquote:border-white/30 prose-blockquote:text-white/80 prose-hr:border-white/20">
            <MDXRemote source={post.content} components={components} />
          </div>

          <time className="block mt-8 text-xl text-white/40">{formattedDate}</time>
      </article>
    </BlogLayout>
  );
}
