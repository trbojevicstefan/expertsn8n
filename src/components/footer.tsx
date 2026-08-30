import Link from "next/link";
import { LockKeyhole, ScrollText, ShieldCheck } from "lucide-react";
import { Brand } from "./brand";

export function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <Brand />
            <p>
              The specialist marketplace for serious n8n work — human-reviewed talent, funded milestones and
              platform-protected collaboration from first message to final release.
            </p>
            <div className="footer-badges">
              <span className="footer-badge"><ShieldCheck size={14} strokeWidth={2.2} />Five-stage vetting</span>
              <span className="footer-badge"><LockKeyhole size={14} strokeWidth={2.2} />Milestone protection</span>
              <span className="footer-badge"><ScrollText size={14} strokeWidth={2.2} />Audit trail</span>
            </div>
          </div>

          <div>
            <h4>Hire</h4>
            <div className="footer-links">
              <Link href="/experts">Find experts</Link>
              <Link href="/sign-up">Post a job</Link>
              <Link href="/#how-it-works">How hiring works</Link>
              <Link href="/#pricing">Pricing</Link>
            </div>
          </div>

          <div>
            <h4>For experts</h4>
            <div className="footer-links">
              <Link href="/sign-up">Apply as an expert</Link>
              <Link href="/jobs">Browse open jobs</Link>
              <Link href="/#vetting">Review process</Link>
              <Link href="/#faq">Expert FAQ</Link>
            </div>
          </div>

          <div>
            <h4>Work types</h4>
            <div className="footer-links">
              <Link href="/experts">Zapier migrations</Link>
              <Link href="/experts">AI agents and RAG</Link>
              <Link href="/experts">CRM automation</Link>
              <Link href="/experts">Monitoring and recovery</Link>
            </div>
          </div>

          <div>
            <h4>Company</h4>
            <div className="footer-links">
              <Link href="/legal/terms">Terms</Link>
              <Link href="/legal/privacy">Privacy</Link>
              <Link href="/legal/marketplace-rules">Marketplace rules</Link>
              <Link href="/#faq">FAQ</Link>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} n8nexperts. Independent marketplace.</span>
          <span>n8n is a trademark of its respective owner. No affiliation or endorsement is implied.</span>
        </div>
      </div>
    </footer>
  );
}
