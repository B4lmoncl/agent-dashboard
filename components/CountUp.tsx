"use client";

import { useEffect, useRef, useState } from "react";

interface CountUpProps {
  value: number;
  duration?: number;      // ms (default 800)
  className?: string;
  style?: React.CSSProperties;
  format?: (n: number) => string;  // custom formatter
  prefix?: string;
  suffix?: string;
}

/**
 * Animated counter that smoothly rolls from previous value to new value.
 * Uses requestAnimationFrame for 60fps butter-smooth counting.
 * Detects value changes and auto-animates.
 */
export default function CountUp({ value, duration = 800, className, style, format, prefix, suffix }: CountUpProps) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = value;

    // Skip animation on first render or if value didn't change
    if (prev === value) return;

    const startTime = performance.now();
    const diff = value - prev;

    // Don't animate tiny changes or zero
    if (diff === 0) { setDisplay(value); return; }

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic for satisfying deceleration
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(prev + diff * eased);
      setDisplay(current);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setDisplay(value); // Ensure exact final value
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  const formatted = format ? format(display) : display.toLocaleString();

  return (
    <span className={className} style={style}>
      {prefix}{formatted}{suffix}
    </span>
  );
}
