'use client';

import Link from 'next/link';
import type { PostMetadata } from '@/lib/posts';
import { ScrambleText } from './ScrambleText';
import { ArrowUpRight } from 'lucide-react';

interface ReadMoreProps {
  posts: PostMetadata[];
}

export function ReadMore({ posts }: ReadMoreProps) {
  if (posts.length === 0) return null;

  return (
    <div className="mt-[200px] pt-8 border-t border-white/10">
      <p className="text-[14px] text-white/30 mb-4 font-[family-name:var(--font-mori)]">Read more</p>
      <ul className="space-y-3">
        {posts.map((post) => (
          <li key={post.slug}>
            <Link
              href={`/posts/${post.slug}`}
              className="text-[24px] text-white hover:text-white/70 transition-colors font-[family-name:var(--font-mondwest)] flex items-center gap-2 overflow-hidden"
            >
              <span className="shrink-0"><ScrambleText text={post.title} /></span>
              <span className="text-white/30 truncate min-w-0">{post.description}</span>
              <ArrowUpRight className="w-5 h-5 text-white shrink-0" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
