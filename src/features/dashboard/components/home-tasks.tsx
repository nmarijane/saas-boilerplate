import type { HomeTask } from "@/shared/shell/view";
import { CheckIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import { IconTile } from "@/shared/components/ui/icon-tile";
import { List, ListRow } from "@/shared/components/ui/list";
import { Link } from "@/shared/lib/i18n-navigation";

interface HomeTasksProps {
  tasks: HomeTask[];
  /** How many of them are done: the figure the shell counted, which is what the heading says. */
  done: number;
}

// The first steps of a workspace, in a card: how many are done, then each step
// in its order. A step that is done is a check on a success tile, with its words
// ("Done:", read out and hidden from the eye, which has the check) and no
// button: there is nothing left to do. A step still to do keeps the tile its
// feature chose and has one secondary button, which leads to where it is done:
// the one main button of the page is the header's.
//
// The button is on the second line of the row, under the label, and not at its
// end: this column is a third of the page, and a label squeezed beside a button
// would break on every word. The steps are an ordered list, as their order is
// the one to follow. Without a step there is nothing to say, and nothing is
// drawn, rather than an empty card.
export function HomeTasks({ tasks, done }: HomeTasksProps) {
  const t = useTranslations("home");

  if (tasks.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-section text-ink">{t("tasks")}</h2>
        <p className="text-meta text-ink-muted">
          {t("tasksProgress", { done, total: tasks.length })}
        </p>
      </div>
      <Card>
        <CardContent>
          <List as="ol">
            {tasks.map((task) =>
              task.done ? (
                <ListRow
                  key={task.id}
                  leading={<IconTile icon={CheckIcon} tone="success" size="sm" />}
                  title={
                    <>
                      <span className="sr-only">{t("taskDone")} </span>
                      <span className="text-ink-muted">{task.label}</span>
                    </>
                  }
                />
              ) : (
                <ListRow
                  key={task.id}
                  leading={
                    <IconTile tone={`t${task.tone}`} size="sm">
                      {task.icon}
                    </IconTile>
                  }
                  title={task.label}
                  meta={
                    <Button
                      asChild
                      variant="secondary"
                      size="sm"
                      className="mt-2"
                    >
                      <Link href={task.action.href}>{task.action.label}</Link>
                    </Button>
                  }
                />
              ),
            )}
          </List>
        </CardContent>
      </Card>
    </section>
  );
}
