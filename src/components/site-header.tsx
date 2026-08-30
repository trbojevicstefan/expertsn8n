import Link from "next/link";
import { Brand } from "./brand";
import { getSession } from "@/lib/auth/server";

export async function SiteHeader() {
  const session = await getSession();
  return (
    <header className="site-header">
      <div className="container header-inner">
        <Brand />
        <nav className="main-nav" aria-label="Main navigation">
          <Link href="/experts">Find experts</Link>
          <Link href="/jobs">Find work</Link>
          <Link href="/#vetting">Vetting</Link>
          <Link href="/#how-it-works">How it works</Link>
          <Link href="/#pricing">Pricing</Link>
        </nav>
        <div className="header-actions">
          {session ? (
            <Link className="button button-ghost" href="/dashboard">Dashboard</Link>
          ) : (
            <>
              <Link className="text-link" href="/sign-in">Log in</Link>
              <Link className="button button-primary" href="/sign-up">Post a job</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
