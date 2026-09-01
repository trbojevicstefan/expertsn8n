import type { NextConfig } from "next";

// Firebase's Google sign-in loads gapi from apis.google.com, embeds
// `__/auth/iframe` from the auth domain and opens `__/auth/handler` in a popup
// that talks back through `window.opener`. A blanket `default-src 'self'` plus
// `COOP: same-origin` silently breaks all three.
const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
const firebaseAuthFrames = [
  "https://*.firebaseapp.com",
  "https://accounts.google.com",
  "https://apis.google.com",
  ...(authDomain && !authDomain.endsWith(".firebaseapp.com") ? [`https://${authDomain}`] : []),
].join(" ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  // `same-origin` would sever window.opener and hang every popup sign-in.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.gstatic.com https://apis.google.com",
      `frame-src 'self' ${firebaseAuthFrames}`,
      "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://*.google.com https://*.firebaseapp.com",
      "worker-src 'self' blob:",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
