import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Apple touch icons must be raster, so this one is drawn rather than shipped. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#c9452b",
        }}
      >
        <svg width="104" height="104" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="8" height="8" rx="2" />
          <path d="M7 11v4a2 2 0 0 0 2 2h4" />
          <rect x="13" y="13" width="8" height="8" rx="2" />
        </svg>
      </div>
    ),
    size,
  );
}
