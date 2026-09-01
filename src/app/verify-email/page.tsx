import { Suspense } from "react";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { VerifyEmailCard } from "@/components/verify-email-card";

export default function VerifyEmailPage() {
  return (
    <>
      <SiteHeader />
      <main className="auth-wrap verify-auth-wrap">
        <section className="auth-art verify-auth-art">
          <div className="verify-art-content">
            <span className="verify-art-eyebrow">
              <ShieldCheck size={17} /> Secure account setup
            </span>
            <h2>One click away from your n8n workspace.</h2>
            <p>
              Confirm your email to protect your account and unlock jobs, proposals, profiles and
              project conversations.
            </p>
            <div className="auth-proof">
              <span><CheckCircle2 size={18} />Your account details are already saved</span>
              <span><CheckCircle2 size={18} />The verification link keeps your account private</span>
              <span><CheckCircle2 size={18} />You will continue exactly where you left off</span>
            </div>
          </div>
        </section>
        <section className="auth-form-wrap verify-form-wrap">
          {/* The card reads the query string, which needs a boundary so the
              rest of the page can still be prerendered. */}
          <Suspense fallback={null}>
            <VerifyEmailCard />
          </Suspense>
        </section>
      </main>
    </>
  );
}
