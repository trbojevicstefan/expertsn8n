import type { MetadataRoute } from "next";

const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://n8nexperts.io").replace(/\/$/, "");

/**
 * Everything behind a session is noise to a crawler and a privacy risk if it
 * ever leaks into an index, so the whole portal is disallowed rather than
 * relying on each page to opt out.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/admin",
        "/dashboard",
        "/settings",
        "/notifications",
        "/support",
        "/contracts",
        "/onboarding",
        "/verify-email",
        "/claim",
      ],
    },
    sitemap: `${appUrl}/sitemap.xml`,
    host: appUrl,
  };
}
