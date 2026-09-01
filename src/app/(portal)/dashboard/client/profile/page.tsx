import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/server";
import { clientProfileForUid, clientProfileGaps } from "@/lib/client-account";
import { ClientProfileForm } from "@/components/client-profile-form";

export const dynamic = "force-dynamic";

export default async function ClientProfilePage() {
  const session = await requireSession();
  if (session.role !== "client") redirect("/dashboard");

  const profile = await clientProfileForUid(session.uid);
  const gaps = clientProfileGaps(profile);

  return (
    <>
      <div className="portal-head">
        <div>
          <h1>Company profile</h1>
          <p>Experts see this when they decide whether to bid on your jobs.</p>
        </div>
      </div>

      {gaps.length > 0 && (
        <div className="notice">
          <strong>Still missing: {gaps.join(", ")}.</strong>
          Fill these in so experts know who they would be working with.
        </div>
      )}

      <ClientProfileForm profile={profile} />
    </>
  );
}
