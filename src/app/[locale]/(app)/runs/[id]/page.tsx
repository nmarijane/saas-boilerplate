import { notFound, redirect  } from "next/navigation";
import {
  PageHeader,
  StatusPill,
} from "@/features/ai-chambers/components/primitives";
import { getActiveOrgId } from "@/features/auth/organization/active-org";
import { getRunById } from "@/features/runs/queries";

export default async function RunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const orgId = await getActiveOrgId();
  if (!orgId) redirect("/onboarding");

  const data = await getRunById(id, orgId);
  if (!data) {
    notFound();
  }

  const { run, files } = data;

  return (
    <div>
      <PageHeader title={`Run ${run.id}`} />
      <p>
        Status: <StatusPill>{run.status}</StatusPill>
      </p>
      <p>Payment: {run.paymentStatus}</p>
      {run.error && <p style={{ color: "red" }}>Error: {run.error}</p>}

      <h2>Files</h2>
      {files.length === 0 ? (
        <p>No files attached.</p>
      ) : (
        <ul>
          {files.map((file) => (
            <li key={file.id}>
              <a
                href={`/api/runs/files/${file.id}`}
                target="_blank"
                rel="noreferrer"
              >
                {file.filename}
              </a>{" "}
              ({Math.round(file.size / 1024)} KB)
            </li>
          ))}
        </ul>
      )}

      {run.result && (
        <>
          <h2>Result</h2>
          <pre>{JSON.stringify(run.result, null, 2)}</pre>
        </>
      )}
    </div>
  );
}
