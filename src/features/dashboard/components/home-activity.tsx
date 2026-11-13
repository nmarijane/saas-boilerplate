import type { ActivityEntry } from "@/shared/shell/contract";
import { ActivityIcon, UserRoundIcon } from "lucide-react";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { EmptyState } from "@/shared/components/data/empty-state";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/shared/components/ui/avatar";
import { Card, CardContent } from "@/shared/components/ui/card";
import { IconTile } from "@/shared/components/ui/icon-tile";
import { InitialTile } from "@/shared/components/ui/initial-tile";
import { List, ListRow } from "@/shared/components/ui/list";
import { notAfter } from "@/shared/utils/helpers";

// The person who did it, in a 32 px circle: their photo, and until it loads (or
// when there is none) a tile of their initials. Without a name there is no one
// to show: a neutral tile with a person in it, as a question mark on one of the
// four tints would read as a warning. It is a picture: the sentence next to it
// says who.
function Actor({ name, image }: { name: string; image: string | null }) {
  if (!name) {
    return (
      <IconTile
        icon={UserRoundIcon}
        tone="neutral"
        size="sm"
        className="rounded-full"
      />
    );
  }

  const tile = <InitialTile name={name} size="sm" className="rounded-full" />;

  if (!image) {
    return tile;
  }

  return (
    <Avatar>
      <AvatarImage src={image} alt="" />
      <AvatarFallback className="bg-transparent">{tile}</AvatarFallback>
    </Avatar>
  );
}

const PLACEHOLDER = /\{(\w+)\}/g;

/** The `{names}` a sentence takes. */
function detailsOf(sentence: string): string[] {
  return [...sentence.matchAll(PLACEHOLDER)].map(([, name = ""]) => name);
}

// The latest events of the workspace, in a card of rows: who did what, and how
// long ago. What was done is a sentence of the message files, `activity.` and
// the name of the event (`activity.api_key.created` for "api_key.created"),
// given the name of the person and the details of the event that are text, so
// that the name of what was made is `{name}`. An event with no sentence (one of
// a feature that is gone, or the start of a name, which is a group of sentences
// and none), or whose sentence wants a detail the event does not carry, is
// "{actor} did something": a list that left it out would hide that something
// happened, and a sentence missing its detail would be shown as the name of the
// message. With no one to name, the person is "Someone".
//
// It is a Server Component on purpose: how long ago it happened is told once,
// from the clock of the server. A row drawn on the client would tell it again
// from another clock, and the two would not agree when the page hydrates.
export function HomeActivity({ entries }: { entries: ActivityEntry[] }) {
  const t = useTranslations("home");
  const tActivity = useTranslations("activity");
  const format = useFormatter();
  const now = useNow();

  return (
    <section className="space-y-4">
      <h2 className="text-section text-ink">{t("activity")}</h2>
      {entries.length === 0 ? (
        <EmptyState
          icon={ActivityIcon}
          title={t("activityEmpty.title")}
          description={t("activityEmpty.description")}
          className="p-6"
        />
      ) : (
        <Card>
          <CardContent>
            <List>
              {entries.map((entry) => {
                const name = entry.actorName?.trim() ?? "";
                // The person comes last: a detail named "actor" does not take their place.
                const values = { ...entry.values, actor: name || tActivity("someone") };
                // `has` finds a group of messages ("project") as well as a
                // sentence: only a text is one.
                const sentence = tActivity.has(entry.action)
                  ? tActivity.raw(entry.action)
                  : null;
                const told =
                  typeof sentence === "string" &&
                  detailsOf(sentence).every((detail) => Object.hasOwn(values, detail));

                return (
                  <ListRow
                    key={entry.id}
                    leading={<Actor name={name} image={entry.actorImage} />}
                    title={
                      told
                        ? tActivity(entry.action, values)
                        : tActivity("other", { actor: values.actor })
                    }
                    meta={
                      <time dateTime={entry.at.toISOString()}>
                        {format.relativeTime(notAfter(entry.at, now), now)}
                      </time>
                    }
                  />
                );
              })}
            </List>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
