import { useTranslations } from "next-intl";
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";

export default function ForgotPasswordPage() {
  const t = useTranslations("auth");

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">{t("resetPassword")}</CardTitle>
        <CardDescription>{t("forgotPassword")}</CardDescription>
      </CardHeader>
      <CardContent>
        <ForgotPasswordForm />
      </CardContent>
    </Card>
  );
}
