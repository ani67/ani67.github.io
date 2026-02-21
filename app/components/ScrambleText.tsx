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

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';

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
  const [minWidth, setMinWidth] = useState<number | undefined>(undefined);
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
    const textLength = originalText.length;
    let iteration = 0;
    const maxIterations = textLength;

    const animate = () => {
      setDisplayText((prev) => {
        return originalText
          .split('')
          .map((char, index) => {
            if (index < iteration) {
              return originalText[index];
            }
            if (char === ' ') {
              return ' ';
            }
            return CHARS[Math.floor(Math.random() * CHARS.length)];
          })
          .join('');
      });

      iteration += 1;

      if (iteration <= maxIterations) {
        timeoutRef.current = setTimeout(animate, 45);
      } else {
        setDisplayText(originalText);
        setIsAnimating(false);
      }
    };

    animate();
  };

  // Measure the width of the final text to prevent layout shifts during scrambling
  useEffect(() => {
    if (containerRef.current) {
      // Temporarily remove minWidth to get natural width
      setMinWidth(undefined);
      // Measure on next frame after minWidth is cleared
      requestAnimationFrame(() => {
        if (containerRef.current) {
          const width = containerRef.current.getBoundingClientRect().width;
          setMinWidth(width);
        }
      });
    }
  }, [text]);

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
        minWidth: minWidth ? `${minWidth}px` : undefined
      }}
      onMouseEnter={handleMouseEnter}
      {...props}
    >
      {displayText}
    </Component>
  );
}
