'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

const SQUARE_SIZE = 150;
const STEPS = 10;
const STEP_INTERVAL = 40;
const INITIAL_HOLD_MS = 1000;   // hold the logo cover this long on first load

/**
 * White pixelated overlay for initial page load and route changes.
 * On mount / pathname change: squares instantly cover the screen,
 * then dissolve in random waves to reveal content.
 */
export function PixelTransition() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isVisible, setIsVisible] = useState(false);
  const [visibleSquares, setVisibleSquares] = useState<Set<number>>(new Set());
  const [gridSize, setGridSize] = useState({ cols: 13, rows: 8 });
  // Ref keeps the latest grid dimensions accessible inside setTimeout callbacks
  const gridRef = useRef({ cols: 13, rows: 8 });
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  // Counts how many times the pathname effect has fired so we can skip mount
  const navCountRef = useRef(0);

  const clearAllTimeouts = () => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
  };

  const startReveal = () => {
    // Cover present → this is the initial page load. Hold the logo for a
    // beat before transitioning so it actually registers visually.
    const cover = document.getElementById('initial-cover');
    const isFirstLoad = cover !== null;
    const holdMs = isFirstLoad ? INITIAL_HOLD_MS : 0;

    // Mobile: no pixel dissolve. Just hold the cover, then remove it.
    if (window.innerWidth < 768) {
      if (cover) {
        const t = setTimeout(() => cover.remove(), holdMs);
        timeoutsRef.current.push(t);
      }
      return;
    }

    const beginDissolve = () => {
      clearAllTimeouts();

      const { cols, rows } = gridRef.current;
      setGridSize({ cols, rows });

      const totalSquares = cols * rows;
      const allIndices = Array.from({ length: totalSquares }, (_, i) => i);

      // Cover the screen instantly (no CSS transition on appearance)
      setIsVisible(true);
      setVisibleSquares(new Set(allIndices));

      // Remove the logo cover *after* the pixel grid has rendered so there's
      // no frame where the underlying page peeks through.
      if (cover) {
        const removeT = setTimeout(() => cover.remove(), 50);
        timeoutsRef.current.push(removeT);
      }

      // Shuffle the removal order for a random dissolve
      const removal = [...allIndices];
      for (let i = removal.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [removal[i], removal[j]] = [removal[j], removal[i]];
      }

      const squaresPerStep = Math.ceil(totalSquares / STEPS);
      let step = 0;

      const animate = () => {
        step++;
        const start = (step - 1) * squaresPerStep;
        const end = Math.min(start + squaresPerStep, removal.length);

        setVisibleSquares(prev => {
          const next = new Set(prev);
          for (let i = start; i < end; i++) next.delete(removal[i]);
          return next;
        });

        if (step < STEPS) {
          const t = setTimeout(animate, STEP_INTERVAL);
          timeoutsRef.current.push(t);
        } else {
          const t = setTimeout(() => {
            setIsVisible(false);
            setVisibleSquares(new Set());
          }, 100);
          timeoutsRef.current.push(t);
        }
      };

      // Brief pause before dissolving so the grid registers visually
      const t = setTimeout(animate, 60);
      timeoutsRef.current.push(t);
    };

    if (holdMs > 0) {
      const t = setTimeout(beginDissolve, holdMs);
      timeoutsRef.current.push(t);
    } else {
      beginDissolve();
    }
  };

  // Grid size — use ref so setTimeout callbacks always read the latest value
  useEffect(() => {
    const calculate = () => {
      const g = {
        cols: Math.ceil(window.innerWidth / SQUARE_SIZE),
        rows: Math.ceil(window.innerHeight / SQUARE_SIZE),
      };
      gridRef.current = g;
    };
    calculate();
    window.addEventListener('resize', calculate);
    return () => window.removeEventListener('resize', calculate);
  }, []);

  // Initial page load — defer by one tick so the grid ref is populated first
  useEffect(() => {
    const t = setTimeout(startReveal, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Route or search param change
  useEffect(() => {
    navCountRef.current++;
    if (navCountRef.current === 1) return; // skip the initial mount fire
    startReveal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearAllTimeouts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isVisible) return null;

  const { cols, rows } = gridSize;
  const totalSquares = cols * rows;

  return (
    <div
      className="fixed inset-0 pointer-events-none z-[9999]"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
      }}
    >
      {Array.from({ length: totalSquares }, (_, i) => (
        <div
          key={i}
          className="transition-opacity duration-75"
          style={{
            backgroundColor: '#ffffff',
            opacity: visibleSquares.has(i) ? 1 : 0,
          }}
        />
      ))}
    </div>
  );
}
