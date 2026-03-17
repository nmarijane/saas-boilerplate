import { useTranslations } from "next-intl";
import { SignInForm } from "@/features/auth/components/sign-in-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";

export default function SignInPage() {
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">{t("signIn")}</CardTitle>
        <CardDescription>{tCommon("appName")}</CardDescription>
      </CardHeader>
      <CardContent>
        <SignInForm />
      </CardContent>
    </Card>
  );
}
