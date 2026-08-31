import { redirect } from "next/navigation";

/**
 * Onboarding used to be a cut-down form that created the profile, after which
 * the real editor only appeared on a reload. The profile is now created when
 * the account is, so there is one editor and people land on it directly.
 */
export default function ExpertOnboarding() {
  redirect("/dashboard/expert/profile");
}
