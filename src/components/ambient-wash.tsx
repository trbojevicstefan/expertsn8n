"use client";

import { useEffect, useRef } from "react";

/**
 * Soft horizontal waves drifting behind the hero, bending around the pointer
 * as it passes.
 *
 * Measured off the reference rather than guessed at: sampling a column of that
 * canvas gives separated bands roughly 30px apart with peak alphas of 3 to 5
 * out of 255, against a canvas maximum of 30 and an element opacity of 0.74.
 * So the brightest line on the page is about 8% visible, and most are nearer
 *

 * The lines exist only around the pointer and dissolve away from it, so what
 * the page shows is the wake of the cursor rather than a permanent pattern.
 * The displacement is followed through a lag and falls off on a bell curve, so
 * what moves is a swell rather than lines stuck to the cursor.
 */
const LINE_GAP = 88;

/**
 * Widest and faintest first: the overlap is what makes the edge disappear.
 *
 * The first pass at this was matched to the reference canvas, which measures
 * about 2% -- and turned out to be invisible, because the lines a reader
 * actually sees on that site are a CSS gradient at 72%, not the canvas. Near
 * the middle of a wide ellipse its arcs read as horizontal lines, which is why
 * they get mistaken for the canvas. These are set by what can be seen against
 * our own paper instead.
 */
const BAND_PASSES = [
  { width: 34, alpha: 0.02 },
  { width: 16, alpha: 0.028 },
  { width: 5, alpha: 0.042 },
];

/** Ink, not the brand red: at this size a warm hue reads as a stain. */
const LINE_RGB = "18, 23, 30";
const POINTER_REACH = 300;
const GLOW_RADIUS = 430;
const POINTER_LIFT = 26;

export function AmbientWash() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const ctx = context;

    // Nothing here answers a touch, and waves this faint are not worth a phone
    // battery: both cases get one painted frame and no loop.
    const still =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      window.matchMedia("(pointer: coarse)").matches;

    let width = 0;
    let height = 0;
    let frame = 0;
    const pointer = { x: -9999, y: -9999, tx: -9999, ty: -9999, active: false };

    const resize = () => {
      const rect = parent.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (time: number) => {
      const t = time / 1000;
      ctx.clearRect(0, 0, width, height);

      // The waves are the pointer's wake: with no pointer there is nothing to
      // draw, and the hero is simply itself.
      if (!pointer.active) {
        frame = requestAnimationFrame(draw);
        return;
      }
      ctx.lineCap = "round";

      pointer.x += (pointer.tx - pointer.x) * 0.05;
      pointer.y += (pointer.ty - pointer.y) * 0.05;

      const lines = Math.ceil(height / LINE_GAP) + 2;
      const step = Math.max(8, Math.round(width / 90));

      for (let i = 0; i < lines; i++) {
        const baseY = (i - 1) * LINE_GAP + (i % 2 ? LINE_GAP * 0.25 : 0);
        // Two waves of different lengths, so the crests never line up into an
        // obvious repeat, and each line runs on its own phase.
        const phase = i * 0.7;
        const amp = 9 + (i % 3) * 4;

        ctx.beginPath();
        for (let x = -step; x <= width + step; x += step) {
          let y =
            baseY +
            Math.sin(x * 0.0042 + t * 0.16 + phase) * amp +
            Math.sin(x * 0.0011 - t * 0.11 + phase * 1.7) * amp * 0.8;

          if (pointer.active) {
            const dx = x - pointer.x;
            const dy = baseY - pointer.y;
            const d2 = (dx * dx + dy * dy) / (POINTER_REACH * POINTER_REACH);
            // A bell curve: the swell has no edge to give itself away.
            y -= Math.exp(-d2) * POINTER_LIFT;
          }

          if (x <= -step) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }

        // Fainter down the page, so it never competes with what sits on it.
        const fade = 1 - (baseY / height) * 0.55;

        // A soft band, not a hairline. Sampling the reference gave strokes
        // tens of pixels thick with no hard edge; three passes of decreasing
        // width buy that falloff for far less than a canvas blur filter.
        for (const pass of BAND_PASSES) {
          const alpha = pass.alpha * fade;
          // Each stroke is painted through a gradient centred on the cursor,
          // so a line exists only where the pointer is and dissolves the rest
          // of the way out. One gradient per stroke is cheaper than cutting
          // every line into segments and fading them by hand.
          const glow = ctx.createRadialGradient(
            pointer.x, pointer.y, 0,
            pointer.x, pointer.y, GLOW_RADIUS,
          );
          glow.addColorStop(0, "rgba(" + LINE_RGB + ", " + alpha.toFixed(4) + ")");
          glow.addColorStop(0.45, "rgba(" + LINE_RGB + ", " + (alpha * 0.55).toFixed(4) + ")");
          glow.addColorStop(1, "rgba(" + LINE_RGB + ", 0)");
          ctx.strokeStyle = glow;
          ctx.lineWidth = pass.width * (i % 3 === 0 ? 1.25 : 1);
          ctx.stroke();
        }
      }

      frame = requestAnimationFrame(draw);
    };

    const onPointerMove = (event: PointerEvent) => {
      const rect = parent.getBoundingClientRect();
      pointer.tx = event.clientX - rect.left;
      pointer.ty = event.clientY - rect.top;
      if (!pointer.active) {
        pointer.x = pointer.tx;
        pointer.y = pointer.ty;
        pointer.active = true;
      }
    };

    resize();
    window.addEventListener("resize", resize);

    if (still) {
      draw(0);
      cancelAnimationFrame(frame);
      return () => window.removeEventListener("resize", resize);
    }

    frame = requestAnimationFrame(draw);
    window.addEventListener("pointermove", onPointerMove, { passive: true });

    // Nothing to paint for a hero that has been scrolled past, or a tab nobody
    // is looking at.
    const onVisibility = () => {
      cancelAnimationFrame(frame);
      if (!document.hidden) frame = requestAnimationFrame(draw);
    };
    document.addEventListener("visibilitychange", onVisibility);

    const observer = new IntersectionObserver((entries) => {
      cancelAnimationFrame(frame);
      if (entries[0]?.isIntersecting) frame = requestAnimationFrame(draw);
    });
    observer.observe(parent);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return <canvas ref={canvasRef} className="ambient-wash" aria-hidden="true" />;
}
