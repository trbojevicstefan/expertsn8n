import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import { consumeFixedWindow, type RateWindowState } from "@/lib/rate-limit-core";

export interface RateLimitConfig {
  scope: string;
  identity: string;
  limit: number;
  windowMs: number;
  message?: string;
}

function hashedKey(scope: string, identity: string): string {
  return createHash("sha256").update(`${scope}\u0000${identity}`).digest("hex");
}

/**
 * Firebase App Hosting/Cloud Run populates X-Forwarded-For. We intentionally
 * keep only the first address and never persist it in plaintext: the limiter
 * hashes the complete scope + identity before it reaches Firestore.
 */
export function clientAddress(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const real = request.headers.get("x-real-ip");
  const candidate = forwarded?.split(",")[0]?.trim() || real?.trim() || "unknown";
  return candidate.slice(0, 128);
}

/**
 * Returns null when the request may proceed, otherwise a ready-to-return 429
 * (or 503 if the distributed limiter itself is unavailable).
 */
export async function enforceRateLimit(config: RateLimitConfig): Promise<NextResponse | null> {
  if (!firebaseAdminConfigured) {
    return NextResponse.json({ error: "Request protection is not available right now." }, { status: 503 });
  }

  const nowMs = Date.now();
  const keyHash = hashedKey(config.scope, config.identity || "unknown");
  const ref = adminDb().collection("_rateLimits").doc(keyHash);

  try {
    const decision = await adminDb().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.data() || {};
      const current: RateWindowState | null =
        typeof data.count === "number" && typeof data.resetAtMs === "number"
          ? { count: data.count, resetAtMs: data.resetAtMs }
          : null;

      const next = consumeFixedWindow(current, nowMs, config.limit, config.windowMs);
      if (next.changed) {
        tx.set(
          ref,
          {
            scope: config.scope,
            count: next.count,
            resetAtMs: next.resetAtMs,
            updatedAt: new Date(nowMs).toISOString(),
            // Can be wired to Firestore TTL; harmless metadata until then.
            expiresAt: new Date(next.resetAtMs + 24 * 60 * 60 * 1000),
          },
          { merge: true },
        );
      }
      return next;
    });

    if (decision.allowed) return null;

    const retryAfter = Math.max(1, Math.ceil((decision.resetAtMs - nowMs) / 1000));
    return NextResponse.json(
      { error: config.message || "Too many requests. Try again shortly." },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          "X-RateLimit-Limit": String(config.limit),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(decision.resetAtMs / 1000)),
        },
      },
    );
  } catch {
    // Sensitive mutation routes should not silently lose abuse protection.
    return NextResponse.json({ error: "Request protection is temporarily unavailable." }, { status: 503 });
  }
}
