import { Suspense } from "react";
import { ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { ResetPasswordForm } from "@/components/reset-password-form";

export const metadata = {
  title: "Choose a new password",
  robots: { index: false, follow: false },
};

export default function ResetPassword() {
  return (
    <>
      <SiteHeader />
      <main className="auth-wrap">
        <section className="auth-art">
          <h2>
            <ShieldCheck size={22} /> Set a new password
          </h2>
          <p>Pick something you do not use anywhere else. You will be signed in with it straight away.</p>
        </section>
        <section className="auth-form-wrap">
          {/* The form reads the reset code from the query string. */}
          <Suspense fallback={null}>
            <ResetPasswordForm />
          </Suspense>
        </section>
      </main>
    </>
  );
}
