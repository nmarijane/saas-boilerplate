import { InvitationEmail } from "@/features/email/templates/invitation";

export default function InvitationPreview() {
  return (
    <InvitationEmail
      inviterName="Jane Smith"
      organizationName="Acme Inc"
      inviteUrl="http://localhost:3000/en/invite?token=abc123"
    />
  );
}
