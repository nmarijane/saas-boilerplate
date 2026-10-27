import { PageHeader } from "@/features/ai-chambers/components/primitives";
import { aiSolutions, aiTools, organization } from "@/models";
import { db } from "@/shared/lib/DB";

export default async function PlatformDashboardPage() {
  const [tools, solutions, organizations] = await Promise.all([
    db.select().from(aiTools),
    db.select().from(aiSolutions),
    db.select().from(organization),
  ]);

  return (
    <div>
      <PageHeader title="Platform Administration" />

      <h2>AI Tools ({tools.length})</h2>
      <ul>
        {tools.map((tool) => (
          <li key={tool.id}>
            {tool.name} — {tool.status}
          </li>
        ))}
      </ul>

      <h2>Tailored Solutions ({solutions.length})</h2>
      <ul>
        {solutions.map((solution) => (
          <li key={solution.id}>
            {solution.name} — {solution.status}
          </li>
        ))}
      </ul>

      <h2>Organizations ({organizations.length})</h2>
      <ul>
        {organizations.map((org) => (
          <li key={org.id}>{org.name}</li>
        ))}
      </ul>
    </div>
  );
}
