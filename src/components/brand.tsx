import Link from "next/link";
import { Workflow } from "lucide-react";

export function Brand() {
  return <Link href="/" className="brand" aria-label="n8nexperts home">
    <span className="brand-mark"><Workflow size={19} strokeWidth={2.4}/></span>
    <span>n8n<span>experts</span></span>
  </Link>;
}
