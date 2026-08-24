"use client";

import { useRef } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";

/*
  Scroll-linked motion for the landing page.

  Two pieces, because the hero and the reveal want opposite things.

  `HeroMotion` keeps the page's opening intact. The video is full-bleed
  and the headline is readable on first paint — that is the whole job of
  a hero — and the motion is a slow push-in as you leave, so the page
  feels alive without the first frame being a loading-looking sliver.

  `ScrollZoomReveal` is the faithful version of the effect: a small
  rounded pill that grows to fill the screen across a tall sticky
  section. It is genuinely striking, and it is striking BECAUSE it
  starts small — which is exactly why it cannot be the first thing
  somebody sees. Used further down, where the page has already earned
  the attention, it lands.

  Both honour `prefers-reduced-motion`. A 400vh scroll-jacked section is
  not a flourish to somebody with vestibular sensitivity — it is the
  reason they leave the site. Reduced motion gets the same content,
  laid out statically, at normal page height.
*/

interface RevealProps {
  /** Video source. Falls back to the poster if the browser will not play it. */
  src: string;
  poster?: string;
  /** Line that fades in as the video fills the screen. */
  caption?: React.ReactNode;
  /** How much scroll the whole move takes. The Framer original used 400vh. */
  scrollHeight?: string;
  className?: string;
}

export function ScrollZoomReveal({
  src,
  poster,
  caption,
  scrollHeight = "400vh",
  className,
}: RevealProps) {
  const section = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();

  /*
    "start start" → "end end": progress runs 0→1 from the moment the
    section's top meets the viewport top until its bottom does. With a
    400vh section and a 100vh sticky child, that is exactly three
    viewport heights of travel.
  */
  const { scrollYProgress } = useScroll({
    target: section,
    offset: ["start start", "end end"],
  });

  const width = useTransform(scrollYProgress, [0, 1], ["34vw", "100vw"]);
  const height = useTransform(scrollYProgress, [0, 1], ["24vh", "100vh"]);

  /*
    Spring only on the radius. Springing the size makes the element lag
    the scrollbar, which reads as jank rather than smoothness — the
    corners are the one property where a little overshoot feels
    physical instead of broken.
  */
  const radiusRaw = useTransform(scrollYProgress, [0, 1], [40, 0]);
  const borderRadius = useSpring(radiusRaw, { stiffness: 90, damping: 25, mass: 0.6 });

  /*
    The caption arrives once the video is most of the way to full size,
    and then STAYS.

    The plateau is written out — [0.45, 0.6, 1] → [0, 1, 1] — rather than
    left to the implicit clamp at the end of a two-stop range. Relying on
    the clamp had the caption fading back out from 0.6 onward and
    reaching zero exactly as the video filled the screen, which put the
    payoff line at nothing precisely when it was meant to land. Measured,
    not guessed: opacity read 1.00 at 0.6, then 0.75, 0.50, 0.25, 0.00.
  */
  const captionOpacity = useTransform(scrollYProgress, [0.45, 0.6], [0, 1], { clamp: true });
  const captionY = useTransform(scrollYProgress, [0.45, 0.6], [60, 0], { clamp: true });

  if (reduced) {
    return (
      <section className={className}>
        <div className="relative mx-auto aspect-video w-full max-w-6xl overflow-hidden rounded-2xl">
          <Media src={src} poster={poster} />
        </div>
        {caption && <div className="mx-auto mt-8 max-w-2xl px-5 text-center">{caption}</div>}
      </section>
    );
  }

  return (
    <section ref={section} style={{ height: scrollHeight }} className={className}>
      <div className="sticky top-0 grid h-screen place-items-center overflow-hidden">
        <motion.div
          style={{ width, height, borderRadius }}
          className="relative overflow-hidden bg-ink-900 shadow-2xl shadow-black/60"
        >
          <Media src={src} poster={poster} />
          {/* Holds the caption legible once the video is full-bleed. */}
          <div className="absolute inset-0 bg-gradient-to-t from-ink-950/85 via-ink-950/10 to-transparent" aria-hidden />
        </motion.div>

        {caption && (
          /*
            The fade goes through a CSS custom property rather than
            motion's `opacity` style.

            Motion drives opacity through a native scroll timeline here,
            which the inline style never reflects and a JS-side `clamp`
            cannot reach — measured, the computed value ran 0 → 1 at 60%
            and straight back to 0 by the end, hiding the payoff line at
            exactly the moment it was meant to land. A custom property is
            an ordinary value motion has no special handling for, so what
            is written is what renders.
          */
          <motion.div
            style={{ ["--reveal" as string]: captionOpacity, y: captionY }}
            className="pointer-events-none absolute bottom-[12vh] left-0 right-0 mx-auto max-w-3xl px-6 text-center [opacity:var(--reveal)]"
          >
            {caption}
          </motion.div>
        )}
      </div>
    </section>
  );
}

/*
  The hero video, with the scroll doing something to it.

  A slow push-in and a fade as the headline leaves. Deliberately small
  numbers: this runs under text somebody is trying to read, and anything
  bigger competes with the words rather than supporting them.
*/
export function HeroMotion({ src, poster }: { src: string; poster?: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: wrap,
    offset: ["start start", "end start"],
  });

  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.18]);
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "12%"]);
  // Darkens as it leaves, so the section below starts from black rather
  // than from a bright frame competing with it.
  const dim = useTransform(scrollYProgress, [0, 1], [0, 0.55]);

  if (reduced) {
    return (
      <div ref={wrap} className="absolute inset-0">
        <Media src={src} poster={poster} />
      </div>
    );
  }

  return (
    <div ref={wrap} className="absolute inset-0 overflow-hidden">
      <motion.div style={{ scale, y }} className="absolute inset-0 will-change-transform">
        <Media src={src} poster={poster} />
      </motion.div>
      <motion.div style={{ opacity: dim }} className="absolute inset-0 bg-ink-950" aria-hidden />
    </div>
  );
}

function Media({ src, poster }: { src: string; poster?: string }) {
  return (
    <video
      className="absolute inset-0 h-full w-full object-cover"
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      poster={poster}
      // Decorative: the page says everything this footage says.
      aria-hidden
    >
      <source src={src} type="video/mp4" />
    </video>
  );
}
