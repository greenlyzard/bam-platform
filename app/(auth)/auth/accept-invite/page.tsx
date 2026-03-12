import { AcceptInviteForm } from "./accept-invite-form";

export const metadata = {
  title: "Accept Invite — Ballet Academy & Movement",
};

export default function AcceptInvitePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-cream px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-heading text-3xl font-semibold text-charcoal">
            Set Up Your Account
          </h1>
          <p className="mt-2 text-sm text-slate">
            Choose a password to complete your account setup.
          </p>
        </div>
        <AcceptInviteForm />
      </div>
    </div>
  );
}
