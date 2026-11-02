/*
 * Adapted from React Bits "Magnet" (TS/CSS variant), MIT + Commons Clause,
 * https://github.com/DavidHDev/react-bits.
 *
 * Kept: the damped spring solver, distance falloff and offset clamp.
 * Changed for this site: pointer listeners are scoped to a local `field`
 * element instead of `window`, tilt/scale and the multi-magnet registry were
 * removed, and the effect is off for touch input, coarse pointers and reduced
 * motion. The child keeps its own semantics; only a wrapper span moves.
 */
import { useEffect, useRef } from "react";
import type { ReactNode, RefObject } from "react";

type MagnetProps = {
  children: ReactNode;
  /** Element whose pointer movement drives the magnet. Defaults to the magnet itself. */
  field?: RefObject<HTMLElement | null>;
  /** Distance (px) outside the child where the pull starts. */
  padding?: number;
  /** Larger values pull less. */
  strength?: number;
  /** Hard cap on the offset in px. */
  maxOffset?: number;
  className?: string;
};

const STIFFNESS = 170;
const DAMPING = 18;

const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

export function Magnet({ children, field, padding = 72, strength = 8, maxOffset = 4, className = "" }: MagnetProps) {
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const innerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const inner = innerRef.current;
    const zone = field?.current ?? wrapper;
    if (!wrapper || !inner || !zone || !window.matchMedia) return;

    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

    const current = { x: 0, y: 0 };
    const velocity = { x: 0, y: 0 };
    const target = { x: 0, y: 0 };
    let raf = 0;
    let last = 0;

    const frame = (now: number) => {
      raf = 0;
      const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
      last = now;
      const steps = Math.ceil(dt / (1 / 120));
      let resting = true;
      for (let i = 0; i < steps; i++) {
        for (const key of ["x", "y"] as const) {
          const force = STIFFNESS * (target[key] - current[key]) - DAMPING * velocity[key];
          velocity[key] += force * (dt / steps);
          current[key] += velocity[key] * (dt / steps);
          if (Math.abs(target[key] - current[key]) > 0.05 || Math.abs(velocity[key]) > 0.05) resting = false;
        }
      }
      if (resting) {
        current.x = target.x;
        current.y = target.y;
        velocity.x = velocity.y = 0;
      }
      inner.style.transform =
        current.x || current.y ? `translate3d(${current.x.toFixed(2)}px, ${current.y.toFixed(2)}px, 0)` : "";
      if (resting) last = 0;
      else raf = requestAnimationFrame(frame);
    };
    const wake = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };

    const onMove = (event: PointerEvent) => {
      if (event.pointerType === "touch" || !finePointer.matches || reduced.matches) return;
      const rect = wrapper.getBoundingClientRect();
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height / 2);
      const outside = Math.hypot(
        Math.max(0, Math.abs(dx) - rect.width / 2),
        Math.max(0, Math.abs(dy) - rect.height / 2),
      );
      const pull = 1 - smoothstep(padding * 0.5, padding, outside);
      let x = (dx / strength) * pull;
      let y = (dy / strength) * pull;
      const length = Math.hypot(x, y);
      if (length > maxOffset) {
        x *= maxOffset / length;
        y *= maxOffset / length;
      }
      target.x = x;
      target.y = y;
      wake();
    };
    const onLeave = () => {
      target.x = target.y = 0;
      wake();
    };

    zone.addEventListener("pointermove", onMove, { passive: true });
    zone.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      zone.removeEventListener("pointermove", onMove);
      zone.removeEventListener("pointerleave", onLeave);
      inner.style.transform = "";
    };
  }, [field, padding, strength, maxOffset]);

  return (
    <span ref={wrapperRef} className={`magnet ${className}`.trim()}>
      <span ref={innerRef} className="magnet-inner">
        {children}
      </span>
    </span>
  );
}
