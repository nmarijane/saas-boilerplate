import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { CSSProperties } from "react";
import { DownloadIcon, PaletteIcon, PlusIcon, UserPlusIcon } from "lucide-react";
import * as React from "react";
import { fn } from "storybook/test";

import { PageHeader } from "@/shared/components/data/page-header";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { ProgressBar } from "@/shared/components/ui/progress-bar";
import { SegmentedControl } from "@/shared/components/ui/segmented-control";
import { OTHER_BRAND } from "./other-brand";

// The tokens of other-brand.ts as the inline style of a subtree. Custom
// properties are not part of CSSProperties.
const otherBrand = OTHER_BRAND as CSSProperties;

function Showcase() {
  const [period, setPeriod] = React.useState("month");

  // `data-brand-scope` is what makes the tokens derived from the brand (tint,
  // focus ring, bar, gradient) compute from the --brand set here: a custom
  // property is resolved where it is declared. It covers this element's own
  // DOM only: the layers that Radix renders in a portal under `document.body`
  // (the "⋯" menu of the header, and DropdownMenu, Select, Popover, Tooltip,
  // Dialog and Sheet anywhere) sit outside it and keep the brand of the page.
  // So does the toaster, mounted once at the root of the layout. For an
  // app-wide or per-tenant brand, set these tokens on <html>, inline or as a
  // :root override: the derived tokens recompute there and no attribute is
  // needed. For a true subtree, render the portals into this element (the
  // Radix Portal `container` prop).
  return (
    <div
      data-brand-scope
      style={otherBrand}
      className="flex max-w-3xl flex-col gap-8"
    >
      <PageHeader
        icon={PaletteIcon}
        title="Welcome back, Camille"
        context="Studio Nord · Pro plan"
        primaryAction={
          <Button>
            <PlusIcon />
            New project
          </Button>
        }
        moreActions={[
          { label: "Invite teammates", icon: UserPlusIcon, onSelect: fn() },
          { label: "Download report", icon: DownloadIcon, onSelect: fn() },
        ]}
      />
      <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
        <Button>Primary</Button>
        <Button variant="outline">Outline</Button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="brand">Pro</Badge>
        <Badge variant="neutral">Free</Badge>
        <Badge variant="success" dot>
          Active
        </Badge>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>AI credits this month</CardTitle>
          <CardDescription>
            82 of 100 used. The bar draws the brand gradient.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <ProgressBar
            label="AI credits this month"
            value={82}
            max={100}
            tone="signature"
          />
          <SegmentedControl
            label="Billing period"
            options={[
              { value: "month", label: "Monthly" },
              { value: "year", label: "Yearly", badge: "2 months free" },
            ]}
            value={period}
            onValueChange={setPeriod}
          />
        </CardContent>
      </Card>
    </div>
  );
}

const meta = {
  title: "Foundations/Other brand",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * A few inline tokens and `data-brand-scope` on one container, and nothing else:
 * no class, no prop. The button, the badge, the tile, the bar and the focus ring
 * (press Tab) take the new brand, the cards and the tile take the 4 px corner,
 * and the title takes the display typeface. Compare with any other story, and
 * switch the theme: the dark counterparts follow. The scope covers this
 * container only: the "⋯" menu opens in a portal under `document.body`, so it
 * keeps the brand of the page. For a whole app or a tenant, set the tokens on
 * `<html>` instead (see Phase 4 of `docs/SETUP.md`).
 */
export const Rebranded: Story = {
  render: () => <Showcase />,
};
