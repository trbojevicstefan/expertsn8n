import { ImageResponse } from "next/og";

export const alt = "n8nexperts — hire reviewed n8n developers";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Rendered at build time so the card needs no asset pipeline or CDN. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#faf7f4",
          padding: 80,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 20,
              background: "#c9452b",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="8" height="8" rx="2" />
              <path d="M7 11v4a2 2 0 0 0 2 2h4" />
              <rect x="13" y="13" width="8" height="8" rx="2" />
            </svg>
          </div>
          <div style={{ fontSize: 44, fontWeight: 700, color: "#12171e", display: "flex" }}>
            n8n<span style={{ color: "#c9452b" }}>experts</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 76, fontWeight: 700, color: "#12171e", lineHeight: 1.05, letterSpacing: -2 }}>
            Hire reviewed n8n developers
          </div>
          <div style={{ fontSize: 32, color: "#5b6470", lineHeight: 1.35 }}>
            Every expert vetted by a human. Real workflow case studies. Funded milestones.
          </div>
        </div>

        <div style={{ display: "flex", height: 8, borderRadius: 4, background: "#c9452b", width: 200 }} />
      </div>
    ),
    size,
  );
}
