"use client";

import { useEffect, useRef } from "react";
import Lenis from "lenis";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";

/*
  The landing page's cinematic layer, ported from the Framer marketplace
  patterns the site is styled after.

  `SmoothScroll` — Lenis on the root scroller. This is most of what makes
  a page feel expensive: scroll input is eased instead of stepped, so the
  scroll-linked hero/reveal animations glide with it. Lenis honours
  prefers-reduced-motion on its own (scroll tracks the input 1:1), and it
  is mounted ONLY on the landing page — the app keeps native scrolling.

  `ScrollSyncedText` — the manifesto treatment: a statement whose words
  ignite from faint to full as the reader scrolls through it. The scroll
  position, not time, is the animation clock, so it reads at exactly the
  reader's pace.

  `Reveal` — the shared in-view entrance for cards and headers: a small
  rise + fade, staggered by the parent, once, near-viewport. Deliberately
  quiet — the sections carry evidence, not fireworks.
*/

export function SmoothScroll() {
  useEffect(() => {
    const lenis = new Lenis({ autoRaf: true, lerp: 0.1 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__lenis = lenis;
    return () => lenis.destroy();
  }, []);
  return null;
}

function Word({
  children,
  progress,
  range,
}: {
  children: string;
  progress: ReturnType<typeof useScroll>["scrollYProgress"];
  range: [number, number];
}) {
  const opacity = useTransform(progress, range, [0.12, 1]);
  return (
    <motion.span style={{ opacity }} className="inline-block">
      {children}&nbsp;
    </motion.span>
  );
}

export function ScrollSyncedText({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    // Starts igniting when the block is 85% down the viewport, finishes
    // while it is still comfortably readable — never mid-exit.
    offset: ["start 0.85", "start 0.35"],
  });

  const words = text.split(" ");

  if (reduced) {
    return (
      <p className="font-display text-3xl font-bold leading-tight tracking-tight text-text-hi md:text-5xl">
        {text}
      </p>
    );
  }

  return (
    <p
      ref={ref}
      className="font-display text-3xl font-bold leading-tight tracking-tight text-text-hi md:text-5xl"
    >
      {words.map((word, i) => (
        <Word
          key={i}
          progress={scrollYProgress}
          range={[i / words.length, (i + 1) / words.length]}
        >
          {word}
        </Word>
      ))}
    </p>
  );
}

export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -60px 0px" }}
      transition={{ duration: 0.55, delay, ease: [0.2, 0.8, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}
