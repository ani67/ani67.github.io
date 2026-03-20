import { format, parseISO, isValid } from 'date-fns';
import { MDXRemote } from 'next-mdx-remote/rsc';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import type { Post } from '@/lib/posts';
import { BlogLayout } from './layout/BlogLayout';
import { VideoAutoplay } from './AutoplayVideo';
import { ReadMore } from './ReadMore';

const rehypeRawOptions = {
  passThrough: [
    'mdxFlowExpression',
    'mdxJsxFlowElement',
    'mdxJsxTextElement',
    'mdxTextExpression',
    'mdxjsEsm',
  ],
};

interface PostPageProps {
  post: Post;
  popularTags: { tag: string; count: number }[];
  relatedPosts?: import('@/lib/posts').PostMetadata[];
}

// Custom image component with caption support
function MDXImage({ src, alt, title }: { src?: string; alt?: string; title?: string }) {
  if (!src) return null;

  if (title) {
    // Image with caption - using spans to avoid invalid p > div/figure nesting
    return (
      <span className="image-with-caption">
        <img src={src} alt={alt || ''} />
        <span className="caption-text">{title}</span>
      </span>
    );
  }

  // Regular image
  return <img src={src} alt={alt || ''} />;
}

// Custom video component
function MDXVideo({ src, controls, style, ...props }: any) {
  if (!src) return null;
  return <video src={src} controls={controls !== false} />;
}

// Custom div component to handle video-with-caption divs
function MDXDiv({ className, children, class: _class, ...props }: any) {
  const resolvedClass = className || _class;
  if (resolvedClass === 'video-with-caption') {
    return (
      <div className="video-with-caption">
        {children}
      </div>
    );
  }
  if (resolvedClass === 'caption-text') {
    return (
      <div className="caption-text">
        {children}
      </div>
    );
  }
  return <div className={resolvedClass}>{children}</div>;
}

// Custom iframe component for YouTube embeds
function MDXIframe({ src, frameborder, allowfullscreen, frameBorder: _fb, ...props }: any) {
  if (!src) return null;
  return (
    <iframe
      src={src}
      frameBorder="0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
      style={{ border: 'none' }}
    />
  );
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
  iframe: MDXIframe,
  div: MDXDiv,
  a: MDXLink,
};

/**
 * Post page component for displaying individual blog posts
 */
export default function PostPageClient({ post, popularTags, relatedPosts = [] }: PostPageProps) {
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

          <VideoAutoplay />
          <div className="prose prose-lg lg:prose-2xl max-w-none prose-headings:font-normal prose-headings:text-white prose-headings:leading-tight prose-headings:mt-8 prose-headings:mb-4 prose-p:text-white/90 prose-p:mb-6 prose-a:text-white prose-a:underline hover:prose-a:text-white prose-strong:text-white prose-code:text-white/90 prose-code:bg-white/10 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-white/10 prose-pre:border prose-pre:border-white/30 prose-ul:text-white/90 prose-ol:text-white/90 prose-li:text-white/90 prose-li:marker:text-white/90">
            <MDXRemote
              source={post.content}
              components={components}
              options={{
                mdxOptions: {
                  remarkPlugins: [remarkGfm],
                  rehypePlugins: [[rehypeRaw, rehypeRawOptions]],
                },
              }}
            />
          </div>

          <time className="block mt-8 text-xl text-white/40">{formattedDate}</time>

          <ReadMore posts={relatedPosts} />
      </article>
    </BlogLayout>
  );
}
