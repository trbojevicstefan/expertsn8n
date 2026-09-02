"use client";

import { useEffect } from "react";

/**
 * Sections arrive rather than appear: a short rise and fade the first time
 * each one reaches the viewport.
 *
 * Marking targets from script rather than by hand means the effect can be
 * added to a page by mounting this once, and — more importantly — a browser
 * that never runs it leaves every section fully visible. Nothing here is
 * allowed to be the reason content cannot be read.
 */
const TARGETS = "main > section, .how-grid > *, .stats-grid > *, .expert-grid > *";

export function Reveal() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const elements = [...document.querySelectorAll<HTMLElement>(TARGETS)];
    if (!elements.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-revealed");
          // One reveal each: re-running it on every scroll past would turn a
          // considered entrance into a flicker.
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.06 },
    );

    for (const el of elements) {
      // Anything already on screen at load has no entrance to make.
      const box = el.getBoundingClientRect();
      if (box.top < window.innerHeight * 0.9) {
        el.classList.add("is-revealed");
        continue;
      }
      el.classList.add("reveal");
      observer.observe(el);
    }

    return () => observer.disconnect();
  }, []);

  return null;
}
