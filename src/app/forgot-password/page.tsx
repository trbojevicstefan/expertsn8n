import { CheckCircle2 } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { ForgotPasswordForm } from "@/components/forgot-password-form";

export const metadata = {
  title: "Reset your password",
  description: "Request a link to choose a new n8nexperts password.",
  robots: { index: false, follow: false },
};

export default function ForgotPassword() {
  return (
    <>
      <SiteHeader />
      <main className="auth-wrap">
        <section className="auth-art">
          <h2>Locked out? It takes a minute to get back in.</h2>
          <p>We will email you a one-hour link to set a new password. Nothing else about your account changes.</p>
          <div className="auth-proof">
            <span><CheckCircle2 size={18} />Your jobs, proposals and contracts stay untouched</span>
            <span><CheckCircle2 size={18} />The link works once and then expires</span>
            <span><CheckCircle2 size={18} />Signed in with Google? Use the Google button instead</span>
          </div>
        </section>
        <section className="auth-form-wrap">
          <ForgotPasswordForm />
        </section>
      </main>
    </>
  );
}
