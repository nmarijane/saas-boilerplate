import type { ProjectSummary } from "../queries";
import { cn } from "@/shared/utils/cn";
import { ProjectCard } from "./project-card";

// How many cards fit across. By the width of the window: one column, two from
// `sm` and three from `lg`, for the list of the projects, which is the width of
// the page. Or by the width of the block that holds the grid (it must be an
// `@container`): two from 448 px and three from 672 px, for a block that is
// not always the width of the page, as the home's is not.
const columnsBy = {
  window: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  container: "grid-cols-1 @md:grid-cols-2 @2xl:grid-cols-3",
} as const;

interface ProjectGridProps {
  projects: ProjectSummary[];
  /** What the columns follow: the window (the default) or the block that holds the grid. */
  columns?: keyof typeof columnsBy;
}

// The cards of a list of projects. Each column shrinks below its content
// (`grid-cols-*` gives it 0 as its least), so that a long name is cut inside its
// card and never pushes the grid.
export function ProjectGrid({ projects, columns = "window" }: ProjectGridProps) {
  return (
    <ul role="list" className={cn("grid gap-4", columnsBy[columns])}>
      {projects.map((project) => (
        <li key={project.id}>
          <ProjectCard project={project} />
        </li>
      ))}
    </ul>
  );
}
