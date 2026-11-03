import { describe, expect, it } from "vitest";
import { PlanBadge } from "@/features/billing/components/plan-badge";
import { Badge } from "@/shared/components/ui/badge";
import { renderWithIntl } from "../../helpers/intl";

describe("planBadge", () => {
  it.each([
    ["free", "neutral", "Free"],
    ["pro", "brand", "Pro"],
    ["enterprise", "success", "Enterprise"],
  ] as const)(
    "draws the %s plan as the %s Badge, in the colors of the theme",
    (planId, variant, label) => {
      expect(renderWithIntl(<PlanBadge planId={planId} />)).toBe(
        renderWithIntl(<Badge variant={variant}>{label}</Badge>),
      );
    },
  );

  it("draws a plan a project adds as the neutral Badge", () => {
    expect(renderWithIntl(<PlanBadge planId="team" />)).toBe(
      renderWithIntl(<Badge variant="neutral">Team</Badge>),
    );
  });
});
