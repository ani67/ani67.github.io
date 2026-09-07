'use client';

import { useRef, useState } from 'react';
import { ImageLightbox, type LightboxImage } from './ImageLightbox';

interface PostContentProps {
  children: React.ReactNode;
}

export function PostContent({ children }: PostContentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [images, setImages] = useState<LightboxImage[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Read the current DOM on click, including images added by streamed content.
  const handleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const container = containerRef.current;
    if (target.tagName !== 'IMG' || !container) return;
    const elements = Array.from(container.querySelectorAll('img')).filter((img) => img.getAttribute('src'));
    const index = elements.indexOf(target as HTMLImageElement);
    if (index < 0) return;
    const collected = elements.map((img) => ({
      src: img.getAttribute('src')!,
      alt: img.getAttribute('alt') || '',
      caption: img.closest('.image-with-caption')?.querySelector('.caption-text')?.textContent ?? null,
    }));
    e.preventDefault();
    setImages(collected);
    setLightboxIndex(index);
  };

  return (
    <>
      <div ref={containerRef} onClick={handleClick}>
        {children}
      </div>

      {lightboxIndex !== null && (
        <ImageLightbox
          images={images}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      )}
    </>
  );
}
