'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { ImageLightbox, type LightboxImage } from './ImageLightbox';

interface PostContentProps {
  children: React.ReactNode;
}

export function PostContent({ children }: PostContentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [images, setImages] = useState<LightboxImage[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Collect all images from the rendered content
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const imgElements = container.querySelectorAll('img');
    const collected: LightboxImage[] = [];

    imgElements.forEach((img) => {
      const src = img.getAttribute('src');
      if (!src) return;

      const alt = img.getAttribute('alt') || '';

      // Look for caption: sibling .caption-text within .image-with-caption parent
      let caption: string | null = null;
      const parent = img.closest('.image-with-caption');
      if (parent) {
        const captionEl = parent.querySelector('.caption-text');
        if (captionEl) caption = captionEl.textContent;
      }

      collected.push({ src, alt, caption });
    });

    setImages(collected);
  }, [children]);

  // Handle click delegation on images
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName !== 'IMG') return;

      const src = target.getAttribute('src');
      if (!src) return;

      const index = images.findIndex((img) => img.src === src);
      if (index !== -1) {
        e.preventDefault();
        setLightboxIndex(index);
      }
    },
    [images]
  );

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
