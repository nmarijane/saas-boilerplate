import { FEATURES } from "@/features/registry";
import {
  ListSkeleton,
  LoadingRegion,
  PageHeaderSkeleton,
} from "@/shared/components/data/skeletons";
import { Card, CardContent } from "@/shared/components/ui/card";
import { collectEntries } from "@/shared/shell/resolve";

// The pages of the settings are one family, a header with its strip of tabs and
// then cards, so they share this one state. The strip has the tabs that the
// installed features give an admin, who sees the most: the registry is static,
// so they are known before any data is there. A member sees fewer once the page
// has arrived, and the strip loses the tabs they cannot open. Then a card of rows.
export default function SettingsLoading() {
  const tabs = collectEntries(
    FEATURES.map((feature) => feature.settings),
    { role: "admin", isPlatformAdmin: false },
  ).length;

  return (
    <LoadingRegion className="space-y-6">
      <PageHeaderSkeleton tabs={tabs} />
      <Card>
        <CardContent>
          <ListSkeleton announce={false} />
        </CardContent>
      </Card>
    </LoadingRegion>
  );
}
