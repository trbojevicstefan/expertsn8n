"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck } from "lucide-react";

export function MarkAllRead({ count }: { count: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const mark = async () => {
    setBusy(true);
    try {
      await fetch("/api/notifications/read", { method: "POST" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <button className="button button-secondary" onClick={mark} disabled={busy}>
      <CheckCheck size={16} strokeWidth={2.2} />
      {busy ? "Marking…" : `Mark ${count} as read`}
    </button>
  );
}
