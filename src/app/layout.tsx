import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import { Reveal } from "@/components/reveal";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://n8nexperts.io";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "n8nexperts — Hire verified n8n developers",
    template: "%s | n8nexperts",
  },
  description:
    "A specialist marketplace for hiring reviewed n8n developers. Every expert is vetted by a human across five stages. Post jobs, compare real workflow case studies, and pay through funded milestones.",
  keywords: [
    "n8n developer",
    "hire n8n expert",
    "n8n freelancer",
    "n8n consultant",
    "workflow automation developer",
    "Zapier to n8n migration",
    "AI agent developer",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    title: "n8nexperts — The n8n talent marketplace",
    description:
      "A directory of n8n specialists. Every profile states whether it has been through review, and work is paid through funded milestones.",
    type: "website",
    siteName: "n8nexperts",
    url: appUrl,
    locale: "en_GB",
  },
  twitter: {
    card: "summary_large_image",
    title: "n8nexperts — Hire verified n8n developers",
    description:
      "Reviewed n8n developers, real workflow case studies and funded milestones.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <body>
        <Reveal />
        {children}
      </body>
    </html>
  );
}
