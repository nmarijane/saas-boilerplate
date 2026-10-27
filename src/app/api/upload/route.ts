import { NextResponse } from "next/server";
import { requireApiAuth } from "@/features/auth/api-auth";
import { uploadFile } from "@/features/upload/actions";

export async function POST(request: Request) {
  const auth = await requireApiAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const formData = await request.formData();

    const result = await uploadFile(formData);

    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 },
      );
    }

    return NextResponse.json(result, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Upload failed", code: "UPLOAD_ERROR", status: 500 },
      { status: 500 },
    );
  }
}
