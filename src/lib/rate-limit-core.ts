export interface RateWindowState {
  count: number;
  resetAtMs: number;
}

export interface RateLimitDecision extends RateWindowState {
  allowed: boolean;
  remaining: number;
  changed: boolean;
}

/**
 * Pure fixed-window policy used by the Firestore-backed limiter.
 *
 * Blocked requests do not increment the counter again. This keeps a hot abusive
 * key read-only until its current window expires while still returning 429.
 */
export function consumeFixedWindow(
  current: RateWindowState | null,
  nowMs: number,
  limit: number,
  windowMs: number,
): RateLimitDecision {
  if (!Number.isInteger(limit) || limit < 1) throw new Error("Rate limit must be a positive integer.");
  if (!Number.isFinite(windowMs) || windowMs <= 0) throw new Error("Rate-limit window must be positive.");

  if (!current || current.resetAtMs <= nowMs || current.count < 0) {
    return {
      allowed: true,
      count: 1,
      remaining: Math.max(0, limit - 1),
      resetAtMs: nowMs + windowMs,
      changed: true,
    };
  }

  if (current.count >= limit) {
    return {
      allowed: false,
      count: current.count,
      remaining: 0,
      resetAtMs: current.resetAtMs,
      changed: false,
    };
  }

  const count = current.count + 1;
  return {
    allowed: true,
    count,
    remaining: Math.max(0, limit - count),
    resetAtMs: current.resetAtMs,
    changed: true,
  };
}
