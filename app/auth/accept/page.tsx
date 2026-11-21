import { AcceptInvite } from "@/components/auth/accept-invite";

export default function AcceptInvitePage() {
  return (
    <main className="flex min-h-screen flex-col justify-center bg-background px-gutter py-8">
      <div className="mx-auto w-full max-w-md">
        <AcceptInvite />
      </div>
    </main>
  );
}
