import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireApiAuth } from "@/features/auth/api-auth";
import { getUserOrganizations } from "@/features/auth/organization/queries";
import { getStorageAdapter } from "@/features/upload/storage/adapter";
import { aiFiles } from "@/models";
import { db } from "@/shared/lib/DB";

async function checkOrgAccess(
  fileOrgId: string,
  sessionUserId: string,
): Promise<boolean> {
  const orgs = await getUserOrganizations(sessionUserId);
  return orgs.some((o) => o.id === fileOrgId);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { id } = await params;
    const file = await db.query.aiFiles.findFirst({
      where: eq(aiFiles.id, id),
    });

    if (!file) {
      return NextResponse.json(
        { error: "File not found", code: "NOT_FOUND", status: 404 },
        { status: 404 },
      );
    }

    const hasAccess = await checkOrgAccess(
      file.organizationId,
      auth.session.user.id,
    );
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Forbidden", code: "FORBIDDEN", status: 403 },
        { status: 403 },
      );
    }

    const storage = await getStorageAdapter();
    const buffer = await storage.get(file.storageKey);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": `inline; filename="${file.filename}"`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch {
    return NextResponse.json(
      {
        error: "Failed to retrieve file",
        code: "RETRIEVAL_ERROR",
        status: 500,
      },
      { status: 500 },
    );
  }
}
