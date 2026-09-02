"use client";

import { useEffect, useRef } from "react";

/**
 * An ambient workflow behind the hero: a sparse grid of nodes wired together,
 * drifting on a slow wave, that leans toward the pointer and occasionally
 * fires a signal down a wire.
 *
 * Everything here is tuned to sit at the edge of noticeable. The pointer is
 * followed through a lag so nothing snaps, the wave is slower than the eye
 * tracks, and the strongest line on screen stays near 22% opacity. It should
 * read as texture that happens to respond, not as an animation asking to be
 * watched.
 */
const SPACING = 118;
const NODE = 3.4;
const POINTER_RADIUS = 230;
const WAVE_AMPLITUDE = 5;

interface Node {
  baseX: number;
  baseY: number;
  x: number;
  y: number;
  phase: number;
  lift: number;
}

interface Pulse {
  from: number;
  to: number;
  t: number;
  life: number;
}

interface Ripple {
  x: number;
  y: number;
  t: number;
}

export function NodeField() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;

    const context = canvas.getContext("2d");
    if (!context) return;
    const ctx = context;

    // A touch device has no pointer to respond to, so the animation would cost
    // battery to show nobody anything. Both cases fall through to one static
    // frame: the texture stays, the motion does not.
    const still =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      window.matchMedia("(pointer: coarse)").matches;

    let nodes: Node[] = [];
    let edges: [number, number][] = [];
    let width = 0;
    let height = 0;
    let frame = 0;
    let visible = true;

    // Followed rather than jumped to: the field leans toward the cursor over
    // roughly a third of a second, which is what keeps it from feeling twitchy.
    const pointer = { x: -9999, y: -9999, tx: -9999, ty: -9999, active: false };
    const pulses: Pulse[] = [];
    const ripples: Ripple[] = [];
    let lastRipple = 0;

    const build = () => {
      const rect = parent.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      nodes = [];
      const cols = Math.ceil(width / SPACING) + 2;
      const rows = Math.ceil(height / SPACING) + 2;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          // Deterministic jitter: a perfect lattice reads as wallpaper, and a
          // freshly random one loses the sense of a wired diagram on resize.
          const seed = Math.sin(c * 12.9898 + r * 78.233) * 43758.5453;
          const jx = ((seed % 1) + 1) % 1;
          const jy = ((Math.sin(seed) % 1) + 1) % 1;
          const x = (c - 1) * SPACING + jx * SPACING * 0.45;
          const y = (r - 1) * SPACING + jy * SPACING * 0.45;
          nodes.push({ baseX: x, baseY: y, x, y, phase: (c + r) * 0.6, lift: 0 });
        }
      }

      edges = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c;
          if (c + 1 < cols) edges.push([i, i + 1]);
          if (r + 1 < rows && (c + r) % 3 === 0) edges.push([i, i + cols]);
        }
      }
    };

    const falloff = (node: Node) => {
      if (!pointer.active) return 0;
      const d = Math.hypot(node.baseX - pointer.x, node.baseY - pointer.y);
      if (d > POINTER_RADIUS) return 0;
      // Cosine rather than linear, so the edge of the influence has no seam.
      return (Math.cos((d / POINTER_RADIUS) * Math.PI) + 1) / 2;
    };

    const draw = (time: number) => {
      const t = time / 1000;
      ctx.clearRect(0, 0, width, height);

      pointer.x += (pointer.tx - pointer.x) * 0.06;
      pointer.y += (pointer.ty - pointer.y) * 0.06;

      for (const n of nodes) {
        const near = falloff(n);
        n.lift += (near - n.lift) * 0.08;
        const wave = Math.sin(t * 0.42 + n.baseX * 0.006 + n.phase) * WAVE_AMPLITUDE;
        const drift = Math.cos(t * 0.3 + n.phase) * 2;
        const pull = pointer.active ? (n.baseX - pointer.x) * 0.012 * n.lift : 0;
        n.x = n.baseX + drift + pull;
        n.y = n.baseY + wave - n.lift * 7;
      }

      // Rings echoing out from the cursor, at the threshold of visible. They
      // are what carries the sense of a wave through the lattice; the nodes
      // alone would read as a static diagram that lights up.
      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i];
        if (!r) continue;
        r.t += 0.0055;
        if (r.t >= 1) { ripples.splice(i, 1); continue; }
        const radius = 40 + r.t * 460;
        ctx.strokeStyle = "rgba(201, 69, 43, " + Math.sin(r.t * Math.PI) * 0.045 + ")";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(r.x, r.y, radius, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (pointer.active && ripples.length < 3 && t - lastRipple > 1.6) {
        lastRipple = t;
        ripples.push({ x: pointer.x, y: pointer.y, t: 0 });
      }

      for (const edge of edges) {
        const na = nodes[edge[0]];
        const nb = nodes[edge[1]];
        if (!na || !nb) continue;
        const strength = Math.max(na.lift, nb.lift);
        ctx.strokeStyle =
          strength > 0.02
            ? "rgba(201, 69, 43, " + (0.05 + strength * 0.17) + ")"
            : "rgba(18, 23, 30, 0.055)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(na.x, na.y);
        // An n8n wire leaves and enters horizontally; these control points keep
        // that shape without the cost of routing around anything.
        const mid = (na.x + nb.x) / 2;
        ctx.bezierCurveTo(mid, na.y, mid, nb.y, nb.x, nb.y);
        ctx.stroke();
      }

      for (const n of nodes) {
        const glow = n.lift;
        ctx.fillStyle =
          glow > 0.02
            ? "rgba(201, 69, 43, " + (0.09 + glow * 0.22) + ")"
            : "rgba(18, 23, 30, 0.085)";
        const size = NODE + glow * 1.6;
        ctx.beginPath();
        ctx.roundRect(n.x - size, n.y - size, size * 2, size * 2, 2);
        ctx.fill();
      }

      for (let i = pulses.length - 1; i >= 0; i--) {
        const p = pulses[i];
        if (!p) continue;
        p.t += 1 / p.life;
        const na = nodes[p.from];
        const nb = nodes[p.to];
        if (p.t >= 1 || !na || !nb) {
          pulses.splice(i, 1);
          continue;
        }
        const x = na.x + (nb.x - na.x) * p.t;
        const y = na.y + (nb.y - na.y) * p.t;
        // Fades in and back out across its travel, so no pulse ever pops.
        ctx.fillStyle = "rgba(201, 69, 43, " + Math.sin(p.t * Math.PI) * 0.42 + ")";
        ctx.beginPath();
        ctx.arc(x, y, 2.1, 0, Math.PI * 2);
        ctx.fill();
      }

      // Occasional, and only along a wire the pointer is already near, so a
      // signal never fires somewhere the eye is not.
      if (pointer.active && pulses.length < 3 && Math.random() < 0.012) {
        const candidates = edges.filter((e) => (nodes[e[0]]?.lift ?? 0) > 0.35);
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        if (pick) pulses.push({ from: pick[0], to: pick[1], t: 0, life: 55 });
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

    const onPointerLeave = () => {
      pointer.active = false;
    };

    build();

    if (still) {
      draw(0);
      cancelAnimationFrame(frame);
      return;
    }

    frame = requestAnimationFrame(draw);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    parent.addEventListener("pointerleave", onPointerLeave);

    const onResize = () => build();
    window.addEventListener("resize", onResize);

    // A hero scrolled past, or a backgrounded tab, has nothing to animate for.
    const observer = new IntersectionObserver((entries) => {
      const nowVisible = Boolean(entries[0]?.isIntersecting);
      if (nowVisible === visible) return;
      visible = nowVisible;
      if (visible) frame = requestAnimationFrame(draw);
      else cancelAnimationFrame(frame);
    });
    observer.observe(parent);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("resize", onResize);
      parent.removeEventListener("pointerleave", onPointerLeave);
    };
  }, []);

  return <canvas ref={canvasRef} className="node-field" aria-hidden="true" />;
}
