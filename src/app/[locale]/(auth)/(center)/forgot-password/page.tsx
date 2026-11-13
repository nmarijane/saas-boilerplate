import { useTranslations } from "next-intl";
import { AuthCard } from "@/features/auth/components/auth-card";
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";
import { TextLink } from "@/shared/components/ui/text-link";
import { Link } from "@/shared/lib/i18n-navigation";

export default function ForgotPasswordPage() {
  const t = useTranslations("auth");

  return (
    <AuthCard
      title={t("resetPassword")}
      description={t("forgotPasswordDescription")}
      footer={
        <TextLink asChild className="tap-target">
          <Link href="/sign-in">{t("backToSignIn")}</Link>
        </TextLink>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
