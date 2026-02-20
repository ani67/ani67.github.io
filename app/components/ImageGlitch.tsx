'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';

interface ImageGlitchProps {
  src: string;
  alt: string;
  className?: string;
  trigger?: boolean;
}

export function ImageGlitch({ src, alt, className = '', trigger = false }: ImageGlitchProps) {
  const gridCols = 9;
  const gridRows = 6;
  const totalSquares = gridCols * gridRows;

  const [visibleSquares, setVisibleSquares] = useState<Set<number>>(new Set());
  const hasTriggeredRef = useRef(false);

  // Trigger animation when parent triggers it
  useEffect(() => {
    // Only trigger once when hover starts
    if (trigger && !hasTriggeredRef.current) {
      hasTriggeredRef.current = true;

      // Generate random 80% coverage
      const initialVisible = Math.floor(totalSquares * 0.8);
      const indices = Array.from({ length: totalSquares }, (_, i) => i);

      // Shuffle
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }

      // Pick first 80% to be visible
      const initialSet = new Set<number>();
      indices.slice(0, initialVisible).forEach(i => initialSet.add(i));

      // Set initial white squares
      setVisibleSquares(initialSet);

      // Start animation after brief delay
      setTimeout(() => {
        const steps = 8;
        const squaresPerStep = Math.ceil(initialSet.size / steps);
        const interval = 60;

        const allVisible = Array.from(initialSet);

        // Shuffle the removal order
        for (let i = allVisible.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [allVisible[i], allVisible[j]] = [allVisible[j], allVisible[i]];
        }

        let currentStep = 0;

        const animate = () => {
          currentStep++;

          const startIndex = (currentStep - 1) * squaresPerStep;
          const endIndex = Math.min(startIndex + squaresPerStep, allVisible.length);

          setVisibleSquares(prev => {
            const newVisible = new Set(prev);
            for (let i = startIndex; i < endIndex; i++) {
              newVisible.delete(allVisible[i]);
            }
            return newVisible;
          });

          if (currentStep < steps) {
            setTimeout(animate, interval);
          }
        };

        animate();
      }, 50);
    }

    // Reset when hover ends
    if (!trigger) {
      hasTriggeredRef.current = false;
      setVisibleSquares(new Set());
    }
  }, [trigger, totalSquares]);

  return (
    <div className={`relative ${className}`}>
      {/* Base image */}
      <Image
        src={src}
        alt={alt}
        fill
        className="object-cover"
        sizes="(max-width: 768px) 100vw, 800px"
        unoptimized
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
      />

      {/* Grid overlay */}
      <div className="absolute inset-0 grid" style={{
        gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
        gridTemplateRows: `repeat(${gridRows}, 1fr)`,
      }}>
        {Array.from({ length: totalSquares }, (_, i) => (
          <div
            key={i}
            className="transition-opacity duration-100"
            style={{
              backgroundColor: 'white',
              opacity: visibleSquares.has(i) ? 1 : 0,
            }}
          />
        ))}
      </div>
    </div>
  );
}
