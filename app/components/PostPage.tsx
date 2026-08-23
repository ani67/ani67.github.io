import { format, parseISO, isValid } from 'date-fns';
import { MDXRemote } from 'next-mdx-remote/rsc';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import type { Post } from '@/lib/posts';
import { BlogLayout } from './layout/BlogLayout';
import { VideoAutoplay } from './AutoplayVideo';
import { ReadMore } from './ReadMore';
import { PostContent } from './PostContent';

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
export default function PostPageClient({ post, relatedPosts = [] }: PostPageProps) {
  // Validate and format date
  const postDate = parseISO(post.date);
  const formattedDate = isValid(postDate)
    ? format(postDate, 'MMMM d, yyyy')
    : 'Invalid date';

  return (
    <BlogLayout useLinks>
      {/* Main Content - Responsive */}
      <article className="flex-1 px-6 pt-16 pb-24 md:px-0 md:pt-10 md:pb-32">
          <header className="mb-8 lg:mb-12">
            <h1 className="text-3xl lg:text-5xl font-normal leading-snug font-[family-name:var(--font-mondwest)]">
              {post.title}
            </h1>
            <p className="mt-4 lg:mt-6 text-xl lg:text-2xl text-ink-muted">{post.description}</p>
          </header>

          <VideoAutoplay />
          <PostContent>
            <div className="prose prose-lg lg:prose-2xl max-w-none prose-headings:font-normal prose-headings:text-ink prose-headings:leading-tight prose-headings:mt-8 prose-headings:mb-4 prose-p:text-ink-body prose-p:mb-6 prose-a:text-ink prose-a:underline hover:prose-a:text-ink prose-strong:text-ink prose-code:text-ink-body prose-code:bg-surface prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-surface prose-pre:border prose-pre:border-hairline-strong prose-ul:text-ink-body prose-ol:text-ink-body prose-li:text-ink-body prose-li:marker:text-ink-body">
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
          </PostContent>

          <time className="block mt-8 text-xl text-ink-subtle">{formattedDate}</time>

          <ReadMore posts={relatedPosts} />
      </article>
    </BlogLayout>
  );
}
