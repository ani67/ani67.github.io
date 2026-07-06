'use client';

import { useState, useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';

const THEME_COLORS = {
  dawn: '#BB3232',
  day: '#4269E8',
  night: '#14151A',
  reader: '#E4E9EC',
};

/**
 * Pixelated transition effect for theme changes
 * Similar to ImageGlitch but for fullscreen background transitions
 */
export function ThemeTransition() {
  const { theme } = useTheme();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [visibleSquares, setVisibleSquares] = useState<Set<number>>(new Set());
  const [oldThemeColor, setOldThemeColor] = useState<string>('');
  const [gridSize, setGridSize] = useState({ cols: 20, rows: 12 });
  const previousThemeRef = useRef<string | undefined>(theme);

  // Calculate grid size based on viewport
  useEffect(() => {
    const calculateGridSize = () => {
      const squareSize = 150; // Target square size in pixels (2.5x larger)
      const cols = Math.ceil(window.innerWidth / squareSize);
      const rows = Math.ceil(window.innerHeight / squareSize);
      setGridSize({ cols, rows });
    };

    calculateGridSize();
    window.addEventListener('resize', calculateGridSize);
    return () => window.removeEventListener('resize', calculateGridSize);
  }, []);

  // Trigger transition when theme changes
  useEffect(() => {
    if (previousThemeRef.current && previousThemeRef.current !== theme && theme) {
      // Store old theme color
      const oldColor = THEME_COLORS[previousThemeRef.current as keyof typeof THEME_COLORS] || THEME_COLORS.day;
      setOldThemeColor(oldColor);

      // Start transition
      setIsTransitioning(true);

      const totalSquares = gridSize.cols * gridSize.rows;

      // Generate random 85% coverage (more coverage than image glitch)
      const initialVisible = Math.floor(totalSquares * 0.85);
      const indices = Array.from({ length: totalSquares }, (_, i) => i);

      // Shuffle
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }

      // Pick first 85% to be visible
      const initialSet = new Set<number>();
      indices.slice(0, initialVisible).forEach(i => initialSet.add(i));

      // Set initial squares (old color)
      setVisibleSquares(initialSet);

      // Start animation after brief delay
      setTimeout(() => {
        const steps = 10;
        const squaresPerStep = Math.ceil(initialSet.size / steps);
        const interval = 50;

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
          } else {
            // End transition
            setTimeout(() => {
              setIsTransitioning(false);
              setVisibleSquares(new Set());
            }, 100);
          }
        };

        animate();
      }, 50);
    }

    previousThemeRef.current = theme;
  }, [theme, gridSize.cols, gridSize.rows]);

  if (!isTransitioning) return null;

  const totalSquares = gridSize.cols * gridSize.rows;

  return (
    <div
      className="fixed inset-0 pointer-events-none z-[9999]"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${gridSize.cols}, 1fr)`,
        gridTemplateRows: `repeat(${gridSize.rows}, 1fr)`,
      }}
    >
      {Array.from({ length: totalSquares }, (_, i) => (
        <div
          key={i}
          className="transition-opacity duration-75"
          style={{
            backgroundColor: oldThemeColor,
            opacity: visibleSquares.has(i) ? 1 : 0,
          }}
        />
      ))}
    </div>
  );
}
