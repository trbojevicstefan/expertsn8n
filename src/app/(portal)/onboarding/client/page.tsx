import { ClientOnboardingForm } from "@/components/client-onboarding-form";

export default function ClientOnboarding() {
  return (
    <>
      <div className="portal-head">
        <div>
          <h1>Set up your client profile</h1>
          <p>Add enough context for experts to evaluate your projects.</p>
        </div>
      </div>
      <ClientOnboardingForm />
    </>
  );
}
