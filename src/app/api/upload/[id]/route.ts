import { NextResponse } from "next/server";
import { requireApiAuth } from "@/features/auth/api-auth";
import { getUserOrganizations } from "@/features/auth/organization/queries";
import { deleteFile } from "@/features/upload/actions";
import { getFileById } from "@/features/upload/queries";
import { getStorageAdapter } from "@/features/upload/storage/adapter";

async function checkFileOwnership(
  fileUserId: string,
  fileOrgId: string | null,
  sessionUserId: string,
): Promise<boolean> {
  if (fileUserId === sessionUserId) return true;

  if (fileOrgId) {
    const orgs = await getUserOrganizations(sessionUserId);
    const orgIds = orgs.map(o => o.id);
    if (orgIds.includes(fileOrgId)) return true;
  }

  return false;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { id } = await params;
    const file = await getFileById(id);

    if (!file) {
      return NextResponse.json(
        { error: "File not found", code: "NOT_FOUND", status: 404 },
        { status: 404 },
      );
    }

    const hasAccess = await checkFileOwnership(file.userId, file.organizationId, auth.session.user.id);
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
        "Content-Type": file.mimetype,
        "Content-Disposition": `inline; filename="${file.filename}"`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to retrieve file", code: "RETRIEVAL_ERROR", status: 500 },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { id } = await params;
    const file = await getFileById(id);

    if (!file) {
      return NextResponse.json(
        { error: "File not found", code: "NOT_FOUND", status: 404 },
        { status: 404 },
      );
    }

    const hasAccess = await checkFileOwnership(file.userId, file.organizationId, auth.session.user.id);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Forbidden", code: "FORBIDDEN", status: 403 },
        { status: 403 },
      );
    }

    const result = await deleteFile(id);

    if ("error" in result) {
      return NextResponse.json(
        { error: result.error, code: "DELETE_FAILED", status: 500 },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete file", code: "DELETE_ERROR", status: 500 },
      { status: 500 },
    );
  }
}
