import { useTranslations } from "next-intl";
import { SignUpForm } from "@/features/auth/components/sign-up-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";

export default function SignUpPage() {
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">{t("signUp")}</CardTitle>
        <CardDescription>{tCommon("appName")}</CardDescription>
      </CardHeader>
      <CardContent>
        <SignUpForm />
      </CardContent>
    </Card>
  );
}
