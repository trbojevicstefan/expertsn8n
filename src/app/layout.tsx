import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://n8nexperts.io"),
  title: { default: "n8nexperts — Hire verified n8n developers", template: "%s | n8nexperts" },
  description: "A specialist marketplace for hiring reviewed n8n developers. Post jobs, invite experts, fund milestones and keep work protected through the platform.",
  openGraph: { title: "n8nexperts — The n8n talent marketplace", description: "Find reviewed n8n developers, fund milestones and manage automation work in one place.", type: "website", siteName: "n8nexperts" },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
