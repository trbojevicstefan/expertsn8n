import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, LifeBuoy, UserRoundSearch } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Footer } from "@/components/footer";

export const metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

/**
 * A dead link here usually means a job that closed or an expert profile that
 * is not published, so the page points at the two directories rather than
 * leaving people to guess.
 */
const routes = [
  {
    href: "/experts",
    Icon: UserRoundSearch,
    title: "Browse experts",
    body: "Reviewed n8n specialists, with the state of every profile on its face.",
  },
  {
    href: "/jobs",
    Icon: BriefcaseBusiness,
    title: "Open projects",
    body: "Public automation jobs currently taking proposals.",
  },
  {
    href: "/support",
    Icon: LifeBuoy,
    title: "Get help",
    body: "Tell us what you were looking for and we will point you at it.",
  },
];

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="page-hero">
          <div className="container">
            <span className="eyebrow">Error 404</span>
            <h1>This page is not here.</h1>
            <p>
              The link may be out of date, the job may have closed, or an expert profile may not be
              published yet. Nothing is broken on your side.
            </p>
            <Link className="button button-primary" href="/" style={{ marginTop: 22 }}>
              Back to the homepage <ArrowRight size={16} strokeWidth={2.2} />
            </Link>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <div className="how-grid">
              {routes.map(({ href, Icon, title, body }) => (
                <Link key={href} className="step-card card" href={href}>
                  <Icon size={20} strokeWidth={2} />
                  <h3>{title}</h3>
                  <p>{body}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
