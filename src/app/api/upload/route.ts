import { NextResponse } from "next/server";
import { uploadFile } from "@/features/upload/actions";

export async function POST(request: Request) {
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
