'use client';

import { useEffect, useCallback, useRef, useState } from 'react';

export interface LightboxImage {
  src: string;
  alt: string;
  caption: string | null;
}

interface ImageLightboxProps {
  images: LightboxImage[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

// Desktop carousel constants
const NEIGHBOR_HEIGHT = 100;
const NEIGHBOR_MAX_WIDTH = 180;
const NEIGHBOR_SPACING = 520;
const VISIBLE_RANGE = 3;
// Mobile breakpoint (matches tailwind md: 800px)
const MD_BREAKPOINT = 800;

export function ImageLightbox({ images, currentIndex, onClose, onNavigate }: ImageLightboxProps) {
  const touchStartX = useRef(0);
  const touchDeltaX = useRef(0);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [phase, setPhase] = useState<'entering' | 'active' | 'exiting'>('entering');
  const [isMobile, setIsMobile] = useState(false);

  const image = images[currentIndex];
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < images.length - 1;

  // Detect mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < MD_BREAKPOINT);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setPhase('active'));
    return () => cancelAnimationFrame(frame);
  }, []);

  const handleClose = useCallback(() => {
    setPhase('exiting');
    setTimeout(() => onClose(), 300);
  }, [onClose]);

  const goNext = useCallback(() => {
    if (hasNext) onNavigate(currentIndex + 1);
  }, [hasNext, currentIndex, onNavigate]);

  const goPrev = useCallback(() => {
    if (hasPrev) onNavigate(currentIndex - 1);
  }, [hasPrev, currentIndex, onNavigate]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
    };
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [handleClose, goNext, goPrev]);

  // Touch swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
    setIsDragging(true);
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    const d = e.touches[0].clientX - touchStartX.current;
    touchDeltaX.current = d;
    setDragX(d);
  };
  const handleTouchEnd = () => {
    setIsDragging(false);
    setDragX(0);
    if (touchDeltaX.current < -60) goNext();
    else if (touchDeltaX.current > 60) goPrev();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-card]')) return;
    handleClose();
  };

  if (!image) return null;

  // Desktop: card style for carousel
  const getDesktopCardStyle = (index: number): React.CSSProperties => {
    const offset = index - currentIndex;
    const isCenter = offset === 0;
    const absOffset = Math.abs(offset);

    let tx = offset * NEIGHBOR_SPACING;
    if (isDragging) tx += dragX;

    const entering = phase === 'entering';
    const exiting = phase === 'exiting';

    return {
      position: 'absolute',
      left: '50%',
      top: '50%',
      transform: `translate(-50%, -50%) translateX(${tx}px) scale(${
        entering ? (isCenter ? 0.85 : 0.9) : exiting ? (isCenter ? 0.9 : 0.95) : 1
      })`,
      maxHeight: isCenter ? 'min(65vh, 580px)' : `${NEIGHBOR_HEIGHT}px`,
      maxWidth: isCenter ? 'min(55vw, 850px)' : `${NEIGHBOR_MAX_WIDTH}px`,
      width: 'auto',
      height: 'auto',
      objectFit: 'contain' as const,
      borderRadius: '8px',
      opacity: entering ? 0 : exiting ? 0 : isCenter ? 1 : Math.max(0, 0.5 - (absOffset - 1) * 0.2),
      filter: isCenter ? 'none' : 'brightness(0.45)',
      cursor: isCenter ? 'default' : 'pointer',
      zIndex: 10 - absOffset,
      transition: isDragging
        ? 'none'
        : 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.45s ease, filter 0.45s ease, max-height 0.5s cubic-bezier(0.16, 1, 0.3, 1), max-width 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
    };
  };

  // Mobile: single image style
  const getMobileImageStyle = (): React.CSSProperties => {
    const entering = phase === 'entering';
    const exiting = phase === 'exiting';

    let tx = isDragging ? dragX : 0;
    const rotation = isDragging ? dragX * 0.01 : 0;

    return {
      maxWidth: 'calc(100vw - 48px)',
      maxHeight: '70vh',
      width: 'auto',
      height: 'auto',
      objectFit: 'contain' as const,
      borderRadius: '8px',
      transform: `translateX(${tx}px) rotate(${rotation}deg) scale(${
        entering ? 0.9 : exiting ? 0.9 : isDragging ? 0.98 : 1
      })`,
      opacity: entering ? 0 : exiting ? 0 : 1,
      transition: isDragging
        ? 'none'
        : 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.35s ease',
    };
  };

  const captionVisible = phase === 'active';

  return (
    <div
      className="fixed inset-0 z-[9999]"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.1)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        opacity: phase === 'entering' ? 0 : phase === 'exiting' ? 0 : 1,
        transition: 'opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
      onClick={handleBackdropClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Preview */}
      <span
        className="absolute top-5 left-5 z-10"
        style={{
          color: 'rgba(255,255,255,0.5)',
          fontSize: '13px',
          fontFamily: 'var(--font-mori), Arial, sans-serif',
          opacity: phase === 'active' ? 1 : 0,
          transition: 'opacity 0.3s ease 0.15s',
        }}
      >
        Preview
      </span>

      {/* Close */}
      <button
        onClick={(e) => { e.stopPropagation(); handleClose(); }}
        className="absolute top-4 right-4 z-10 text-ink/60 hover:text-ink transition-colors p-2"
        style={{
          opacity: phase === 'active' ? 1 : 0,
          transition: 'opacity 0.3s ease 0.15s',
        }}
        aria-label="Close"
      >
        <svg className="w-6 h-6" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
          <path d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {isMobile ? (
        /* ─── Mobile: full-width single image with swipe ─── */
        <>
          {/* Image centered */}
          <div className="absolute inset-0 flex items-center justify-center px-6">
            <img
              key={currentIndex}
              data-card
              src={image.src}
              alt={image.alt}
              className="select-none"
              style={getMobileImageStyle()}
              draggable={false}
            />
          </div>

          {/* Counter above image */}
          {images.length > 1 && (
            <div
              className="absolute left-0 right-0 flex justify-center pointer-events-none"
              style={{
                top: 'calc(50% - 37vh)',
                zIndex: 20,
                color: 'rgba(255,255,255,0.3)',
                fontSize: '12px',
                fontFamily: 'var(--font-mori), Arial, sans-serif',
                opacity: phase === 'active' ? 1 : 0,
                transition: 'opacity 0.3s ease 0.15s',
              }}
            >
              {currentIndex + 1} / {images.length}
            </div>
          )}

          {/* Caption below image */}
          {image.caption && (
            <div
              className="absolute left-0 right-0 flex justify-center pointer-events-none px-6"
              style={{
                top: 'calc(50% + 37vh)',
                zIndex: 20,
                color: 'rgba(255,255,255,0.6)',
                fontSize: '13px',
                fontFamily: 'var(--font-mori), Arial, sans-serif',
                lineHeight: '1.4',
                textAlign: 'center',
                opacity: captionVisible ? 1 : 0,
                transform: captionVisible ? 'translateY(0)' : 'translateY(6px)',
                transition: 'opacity 0.35s ease 0.1s, transform 0.35s cubic-bezier(0.16, 1, 0.3, 1) 0.1s',
              }}
            >
              {image.caption}
            </div>
          )}

          {/* Dot indicators */}
          {images.length > 1 && (
            <div
              className="absolute bottom-8 left-0 right-0 flex justify-center gap-1.5 pointer-events-none"
              style={{
                zIndex: 20,
                opacity: phase === 'active' ? 1 : 0,
                transition: 'opacity 0.3s ease 0.15s',
              }}
            >
              {images.map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: i === currentIndex ? '16px' : '5px',
                    height: '5px',
                    borderRadius: '3px',
                    backgroundColor: i === currentIndex ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.25)',
                    transition: 'width 0.3s ease, background-color 0.3s ease',
                  }}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        /* ─── Desktop: carousel with side cards ─── */
        <>
          {/* Cards */}
          <div className="absolute inset-0 overflow-hidden">
            {images.map((img, i) => {
              if (Math.abs(i - currentIndex) > VISIBLE_RANGE) return null;
              return (
                <img
                  key={i}
                  data-card
                  src={img.src}
                  alt={img.alt}
                  className="select-none"
                  style={getDesktopCardStyle(i)}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (i !== currentIndex) onNavigate(i);
                  }}
                  draggable={false}
                />
              );
            })}
          </div>

          {/* Counter above image */}
          <div
            className="absolute left-0 right-0 flex flex-col items-center pointer-events-none"
            style={{
              top: '50%',
              transform: 'translateY(calc(-50% - min(32.5vh, 290px) - 8px))',
              zIndex: 20,
            }}
          >
            {images.length > 1 && (
              <div
                style={{
                  color: 'rgba(255,255,255,0.3)',
                  fontSize: '12px',
                  fontFamily: 'var(--font-mori), Arial, sans-serif',
                  opacity: phase === 'active' ? 1 : 0,
                  transition: 'opacity 0.3s ease 0.15s',
                  transform: phase === 'active' ? 'translateY(0)' : 'translateY(-6px)',
                }}
              >
                {currentIndex + 1} / {images.length}
              </div>
            )}
          </div>

          {/* Caption below image */}
          <div
            className="absolute left-0 right-0 flex flex-col items-center pointer-events-none"
            style={{
              top: '50%',
              transform: 'translateY(calc(-50% + min(32.5vh, 290px) + 8px))',
              zIndex: 20,
            }}
          >
            {image.caption && (
              <div
                style={{
                  color: 'rgba(255,255,255,0.6)',
                  fontSize: '13px',
                  fontFamily: 'var(--font-mori), Arial, sans-serif',
                  lineHeight: '1.4',
                  opacity: captionVisible ? 1 : 0,
                  transform: captionVisible ? 'translateY(0)' : 'translateY(6px)',
                  transition: 'opacity 0.35s ease 0.1s, transform 0.35s cubic-bezier(0.16, 1, 0.3, 1) 0.1s',
                  maxWidth: '55vw',
                  textAlign: 'center' as const,
                }}
              >
                {image.caption}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
