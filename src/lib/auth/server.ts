import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { SessionUser, UserRole } from "@/lib/types";
import { adminAuth, adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";

const cookieName = process.env.SESSION_COOKIE_NAME || "n8nexperts_session";

function demoSession(): SessionUser | null {
  if (process.env.DEMO_MODE !== "true") return null;
  const role = (process.env.DEMO_ROLE || "client") as UserRole;
  return { uid: `demo_${role}`, email: `${role}@demo.n8nexperts.io`, name: role === "admin" ? "Marketplace Admin" : role === "expert" ? "Ana Kovacevic" : "Alex Morgan", role, admin: role === "admin" };
}

export async function getSession(): Promise<SessionUser | null> {
  const demo = demoSession();
  if (demo) return demo;
  if (!firebaseAdminConfigured) return null;
  const store = await cookies();
  const value = store.get(cookieName)?.value;
  if (!value) return null;
  try {
    const decoded = await adminAuth().verifySessionCookie(value, true);
    const userDoc = await adminDb().collection("users").doc(decoded.uid).get();
    const data = userDoc.data() || {};
    const role = (data.role || (decoded.admin ? "admin" : "client")) as UserRole;
    return { uid: decoded.uid, email: decoded.email || data.email || "", name: decoded.name || data.name, role, admin: decoded.admin === true || role === "admin" };
  } catch {
    return null;
  }
}

export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/sign-in?next=/dashboard");
  return session;
}

export async function requireAdmin() {
  const session = await requireSession();
  if (!session.admin && session.role !== "admin") redirect("/dashboard");
  return session;
}

export { cookieName };
