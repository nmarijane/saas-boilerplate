import { NextResponse } from "next/server";
import { deleteFile } from "@/features/upload/actions";
import { getFileById } from "@/features/upload/queries";
import { getStorageAdapter } from "@/features/upload/storage/adapter";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const file = await getFileById(id);

    if (!file) {
      return NextResponse.json(
        { error: "File not found", code: "NOT_FOUND", status: 404 },
        { status: 404 },
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
  try {
    const { id } = await params;
    const result = await deleteFile(id);

    if ("error" in result) {
      return NextResponse.json(
        { error: result.error, code: "NOT_FOUND", status: 404 },
        { status: 404 },
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
