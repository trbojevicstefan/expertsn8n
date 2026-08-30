import { CheckCircle2, FileText, Image as ImageIcon, ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { ClaimForm } from "@/components/claim-form";

export const metadata = {
  title: "Claim your profile",
  description: "Take ownership of the n8nexperts profile created from your application.",
  robots: { index: false, follow: false },
};

export default function ClaimPage() {
  return (
    <>
      <SiteHeader />
      <main className="auth-wrap">
        <section className="auth-art">
          <h2>Your profile is already live.</h2>
          <p>
            We created it from the application you emailed us. Claiming it puts you in control of the
            copy, the rate, the availability and the documents behind it.
          </p>
          <div className="auth-proof">
            <span><CheckCircle2 size={17} strokeWidth={2.2} />Edit your bio, rate and availability</span>
            <span><ImageIcon size={17} strokeWidth={2.2} />Pull your photo from Google in one click</span>
            <span><FileText size={17} strokeWidth={2.2} />Upload your CV and portfolio</span>
            <span><ShieldCheck size={17} strokeWidth={2.2} />Nothing is public until you say so</span>
          </div>
        </section>
        <section className="auth-form-wrap">
          <ClaimForm />
        </section>
      </main>
    </>
  );
}
