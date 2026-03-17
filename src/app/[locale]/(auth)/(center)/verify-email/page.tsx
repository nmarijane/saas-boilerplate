import { useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";

export default function VerifyEmailPage() {
  const t = useTranslations("auth");

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">{t("verifyEmail")}</CardTitle>
        <CardDescription>{t("emailSent")}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-center text-sm text-muted-foreground">
          <a href="/sign-in" className="text-primary hover:underline">
            {t("signIn")}
          </a>
        </p>
      </CardContent>
    </Card>
  );
}
