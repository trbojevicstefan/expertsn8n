import { requireSession } from "@/lib/auth/server";
import { clientProfileForUid } from "@/lib/client-account";
import { ClientProfileForm } from "@/components/client-profile-form";

export const dynamic = "force-dynamic";

export default async function ClientOnboarding() {
  const session = await requireSession();
  const profile = await clientProfileForUid(session.uid);

  return (
    <>
      <div className="portal-head">
        <div>
          <h1>Set up your client profile</h1>
          <p>Add enough context for experts to evaluate your projects.</p>
        </div>
      </div>
      <ClientProfileForm profile={profile} redirectTo="/dashboard/client/jobs/new" submitLabel="Save and post a job" />
    </>
  );
}
