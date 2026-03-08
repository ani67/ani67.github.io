'use client';

import { useState, useEffect, useRef } from 'react';

interface ScrambleTextProps {
  text: string;
  className?: string;
  as?: 'span' | 'h1' | 'h2' | 'h3' | 'h4' | 'a' | 'button';
  triggerOnMount?: boolean;
  disableHover?: boolean;
  trigger?: boolean;
  onTrigger?: () => void;
  [key: string]: any;
}

const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const DIGITS = '0123456789';

function randomCharLike(char: string): string {
  if (char >= 'A' && char <= 'Z') return UPPER[Math.floor(Math.random() * UPPER.length)];
  if (char >= 'a' && char <= 'z') return LOWER[Math.floor(Math.random() * LOWER.length)];
  if (char >= '0' && char <= '9') return DIGITS[Math.floor(Math.random() * DIGITS.length)];
  return char;
}

export function ScrambleText({
  text,
  className = '',
  as: Component = 'span',
  triggerOnMount = false,
  disableHover = false,
  trigger = false,
  onTrigger,
  ...props
}: ScrambleTextProps) {
  const [displayText, setDisplayText] = useState(text);
  const [isAnimating, setIsAnimating] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const mountedRef = useRef(false);
  const containerRef = useRef<HTMLElement>(null);

  const scramble = () => {
    if (window.innerWidth < 768) return;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setIsAnimating(true);
    const originalText = text;
    const duration = 300;
    const frameInterval = 50;
    const totalFrames = Math.floor(duration / frameInterval);
    let frame = 0;
    // Short text: scramble more (70%). Long text: scramble less (15%).
    const initialRatio = Math.max(0.15, Math.min(0.7, 10 / originalText.length));

    const animate = () => {
      frame += 1;
      const scrambleRatio = initialRatio * (1 - frame / totalFrames);

      setDisplayText(
        originalText
          .split('')
          .map((char) => {
            if (char === ' ') return ' ';
            if (Math.random() < scrambleRatio) return randomCharLike(char);
            return char;
          })
          .join('')
      );

      if (frame < totalFrames) {
        timeoutRef.current = setTimeout(animate, frameInterval);
      } else {
        setDisplayText(originalText);
        setIsAnimating(false);
      }
    };

    animate();
  };


  useEffect(() => {
    if (triggerOnMount && !mountedRef.current) {
      mountedRef.current = true;
      scramble();
    }
  }, [triggerOnMount]);

  // Trigger animation when parent triggers it
  useEffect(() => {
    if (trigger && !isAnimating) {
      scramble();
    }
  }, [trigger]);

  useEffect(() => {
    if (onTrigger) {
      // Expose scramble function through callback
      (window as any).__scrambleCallbacks = (window as any).__scrambleCallbacks || {};
      (window as any).__scrambleCallbacks[text] = scramble;
    }
    return () => {
      if (onTrigger && (window as any).__scrambleCallbacks) {
        delete (window as any).__scrambleCallbacks[text];
      }
    };
  }, [text, onTrigger]);

  const handleMouseEnter = () => {
    if (!disableHover) {
      scramble();
    }
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const pointerClass = disableHover ? 'pointer-events-none' : '';

  return (
    <Component
      ref={containerRef as any}
      className={`${className} inherit-color ${pointerClass}`}
      style={{
        color: 'inherit',
        display: 'inline-block',
      }}
      onMouseEnter={handleMouseEnter}
      {...props}
    >
      {displayText}
    </Component>
  );
}
