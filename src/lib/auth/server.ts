import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { SessionUser, UserRole } from "@/lib/types";
import { adminAuth, adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";

const cookieName = process.env.SESSION_COOKIE_NAME || "n8nexperts_session";

/**
 * The only way to hold a session is a verified Firebase session cookie. There
 * is no environment flag that mints one: an unauthenticated request is
 * unauthenticated everywhere, including locally.
 */
export async function getSession(): Promise<SessionUser | null> {
  if (!firebaseAdminConfigured) return null;
  const store = await cookies();
  const value = store.get(cookieName)?.value;
  if (!value) return null;
  try {
    const decoded = await adminAuth().verifySessionCookie(value, true);
    // Password accounts must prove ownership of the mailbox before they can
    // access authenticated marketplace pages. OAuth providers such as Google
    // already verify the address as part of their sign-in flow.
    if (
      decoded.email_verified === false &&
      decoded.firebase?.sign_in_provider === "password"
    ) {
      return null;
    }
    const userDoc = await adminDb().collection("users").doc(decoded.uid).get();
    const data = userDoc.data() || {};
    const role = (data.role || (decoded.admin ? "admin" : "client")) as UserRole;
    return {
      uid: decoded.uid,
      email: decoded.email || data.email || "",
      name: decoded.name || data.name,
      role,
      admin: decoded.admin === true || role === "admin",
    };
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
