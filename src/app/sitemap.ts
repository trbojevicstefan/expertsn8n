import type { MetadataRoute } from "next";
import { listPublicJobs, listPublishedExperts } from "@/lib/data";

const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://n8nexperts.io").replace(/\/$/, "");

export const revalidate = 3600;

/**
 * Expert and job pages are the reason this site gets found at all, so they are
 * enumerated rather than left to discovery through the paginated listings.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${appUrl}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${appUrl}/experts`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${appUrl}/jobs`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${appUrl}/sign-up`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${appUrl}/sign-in`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${appUrl}/legal/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${appUrl}/legal/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${appUrl}/legal/marketplace-rules`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];

  // A sitemap that throws takes the whole route down; an incomplete one still
  // serves the static pages while the data layer recovers.
  const [experts, jobs] = await Promise.all([
    listPublishedExperts().catch(() => []),
    listPublicJobs().catch(() => []),
  ]);

  return [
    ...staticEntries,
    ...experts.map((expert) => ({
      url: `${appUrl}/experts/${expert.slug}`,
      lastModified: expert.updatedAt ? new Date(expert.updatedAt) : now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...jobs.map((job) => ({
      url: `${appUrl}/jobs/${job.id}`,
      lastModified: job.postedAt ? new Date(job.postedAt) : now,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
  ];
}
