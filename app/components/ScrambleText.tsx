'use client';

import { useState, useEffect, useRef, useCallback, type HTMLAttributes } from 'react';

interface ScrambleTextProps extends HTMLAttributes<HTMLElement> {
  href?: string;
  target?: string;
  rel?: string;
  type?: 'button' | 'submit' | 'reset';
  text: string;
  className?: string;
  as?: 'span' | 'h1' | 'h2' | 'h3' | 'h4' | 'a' | 'button';
  triggerOnMount?: boolean;
  disableHover?: boolean;
  trigger?: boolean;
  onTrigger?: () => void;
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

  const scramble = useCallback(() => {
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

    timeoutRef.current = setTimeout(animate, frameInterval);
  }, [text]);


  useEffect(() => {
    if (!triggerOnMount || mountedRef.current) return;
    const timer = setTimeout(() => {
      mountedRef.current = true;
      scramble();
    }, 0);
    return () => clearTimeout(timer);
  }, [triggerOnMount, scramble]);

  useEffect(() => {
    if (!trigger) return;
    const timer = setTimeout(scramble, 0);
    return () => clearTimeout(timer);
  }, [trigger, scramble]);

  useEffect(() => {
    if (!onTrigger) return;
    const host = window as Window & { __scrambleCallbacks?: Record<string, () => void> };
    const callbacks = host.__scrambleCallbacks ??= {};
    callbacks[text] = scramble;
    return () => { delete callbacks[text]; };
  }, [text, onTrigger, scramble]);

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

  /*
   * The real text always holds the box, and the scrambling text floats over it.
   *
   * Substituted glyphs are rarely the same width as the ones they replace — the
   * site's display face is proportional, not monospaced — so rendering the
   * scramble in the flow resized the element on every frame and shoved its
   * neighbours around. Sizing from `text` instead pins the width to what the
   * word will settle at, and the overlay is free to be any width without the
   * layout noticing.
   *
   * While animating, the in-flow copy goes transparent rather than hidden: it
   * stays in the accessibility tree and in the text selection, so the word can
   * still be read and copied mid-scramble, while the overlay — decoration only
   * — is hidden from assistive tech.
   */
  return (
    <Component
      className={`${className} inherit-color ${pointerClass}`}
      style={{
        color: 'inherit',
        display: 'inline-block',
        position: 'relative',
        whiteSpace: 'pre',
      }}
      onMouseEnter={handleMouseEnter}
      {...props}
    >
      <span style={isAnimating ? { color: 'transparent' } : undefined}>{text}</span>
      {isAnimating && (
        <span
          aria-hidden="true"
          style={{ position: 'absolute', left: 0, top: 0, whiteSpace: 'pre' }}
        >
          {displayText}
        </span>
      )}
    </Component>
  );
}
