'use client';

import { useEffect } from 'react';

export function VideoAutoplay() {
  useEffect(() => {
    const interacted = new WeakSet<HTMLVideoElement>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const video = entry.target as HTMLVideoElement;
          if (interacted.has(video)) continue;

          // Ensure muted + loop for autoplay to work
          video.muted = true;
          video.loop = true;
          video.playsInline = true;

          if (entry.isIntersecting) {
            video.play().catch(() => {});
          } else {
            video.pause();
          }
        }
      },
      { threshold: 0.5 }
    );

    const handleClick = (e: Event) => {
      interacted.add(e.currentTarget as HTMLVideoElement);
    };

    const videos = document.querySelectorAll<HTMLVideoElement>('.prose video');
    videos.forEach((video) => {
      video.addEventListener('click', handleClick);
      observer.observe(video);
    });

    return () => {
      videos.forEach((video) => {
        video.removeEventListener('click', handleClick);
      });
      observer.disconnect();
    };
  }, []);

  return null;
}
