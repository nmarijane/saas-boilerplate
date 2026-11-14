import type { UploadRefusal } from "@/features/upload/refusals";
import { getTranslations } from "next-intl/server";
import { NextResponse } from "next/server";
import { requireApiAuth } from "@/features/auth/api-auth";
import { getActiveOrgId } from "@/features/auth/organization/active-org";
import { messageKeyOf } from "@/features/upload/refusals";
import { uploadFile } from "@/features/upload/service";

/**
 * The 400 of a file that is refused, in the shape of the other errors of the
 * route: `error` is an English sentence for the clients of the API (the locales'
 * own, in English: the words are not written here), `code` says which refusal it
 * is, and `values` holds what the page needs to tell it in its own language.
 */
async function refusalResponse(refusal: string | UploadRefusal) {
  if (typeof refusal === "string") {
    return NextResponse.json({ error: refusal, code: "MISSING_FIELDS", status: 400 }, { status: 400 });
  }

  const t = await getTranslations({ locale: "en" });
  return NextResponse.json(
    {
      error: t(messageKeyOf(refusal.code), refusal.values),
      code: refusal.code,
      status: refusal.code === "PLAN_LIMIT" ? 402 : 400,
      values: refusal.values,
    },
    // A full plan is a 402: the file is fine, the workspace has no room for it
    { status: refusal.code === "PLAN_LIMIT" ? 402 : 400 },
  );
}

export async function POST(request: Request) {
  const auth = await requireApiAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const formData = await request.formData();

    const orgId = await getActiveOrgId();
    if (!orgId) {
      return NextResponse.json(
        { error: "No active organization", code: "NO_ORG", status: 400 },
        { status: 400 },
      );
    }

    formData.set("userId", auth.session.user.id);
    formData.set("orgId", orgId);

    const result = await uploadFile(formData);

    if (result.error) {
      return await refusalResponse(result.error);
    }

    return NextResponse.json(result, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Upload failed", code: "UPLOAD_ERROR", status: 500 },
      { status: 500 },
    );
  }
}
