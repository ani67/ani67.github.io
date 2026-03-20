'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { PostMetadata } from '@/lib/posts';
import { ScrambleText } from './ScrambleText';
import { ImageGlitch } from './ImageGlitch';
import { getSvgPath } from 'figma-squircle';

interface PostCardProps {
  post: PostMetadata;
}

export function PostCard({ post }: PostCardProps) {
  const [isHovering, setIsHovering] = useState(false);

  // Generate squircle path for 16:9 aspect ratio
  const squirclePath = useMemo(() => {
    return getSvgPath({
      width: 100,
      height: 56.25, // 16:9 ratio (100 / 16 * 9)
      cornerRadius: 2,
      cornerSmoothing: 1,
    });
  }, []);

  const clipId = useMemo(() => `squircle-${post.slug}`, [post.slug]);

  return (
    <article
      className="group"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <Link href={`/posts/${post.slug}`} className="block">
        <h4 className="text-xl lg:text-3xl font-normal mb-2 font-[family-name:var(--font-mondwest)]">
          <ScrambleText
            text={post.title}
            className="text-white"
            disableHover={true}
            trigger={isHovering}
          />
        </h4>
        <p className="text-white/50 group-hover:text-white transition-colors text-base md:text-xl mb-4 line-clamp-2 font-[family-name:var(--font-mondwest)]">
          {post.description}
        </p>
        {/* Post image */}
        {post.image && (
          <>
            <svg width="0" height="0" style={{ position: 'absolute' }}>
              <defs>
                <clipPath id={clipId} clipPathUnits="objectBoundingBox">
                  <path
                    d={squirclePath}
                    transform="scale(0.01, 0.01778)"
                  />
                </clipPath>
              </defs>
            </svg>
            <div
              className="w-full aspect-video bg-white/10 overflow-hidden"
              style={{ clipPath: `url(#${clipId})` }}
            >
              <ImageGlitch
                src={post.image}
                alt={post.title}
                className="w-full h-full"
                trigger={isHovering}
              />
            </div>
          </>
        )}
      </Link>
    </article>
  );
}
