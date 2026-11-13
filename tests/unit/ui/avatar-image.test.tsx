import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AvatarImage } from "@/shared/components/ui/avatar";

// Radix draws the `<img>` only once the browser has loaded the picture, so what the component
// asks of the image is read where it hands it over
const { received } = vi.hoisted(() => ({ received: [] as Record<string, unknown>[] }));
vi.mock("@radix-ui/react-avatar", () => ({
  Root: () => null,
  Fallback: () => null,
  Image: (props: Record<string, unknown>) => {
    received.push(props);
    return null;
  },
}));

function draw(props: Partial<ComponentProps<typeof AvatarImage>> = {}) {
  received.length = 0;
  renderToStaticMarkup(<AvatarImage src="https://cdn.example.com/me.png" alt="" {...props} />);

  return received[0] ?? {};
}

describe("the picture of a person", () => {
  // The server that holds a picture is not the app's: it is not told which page the person is on, and gets no cookies
  it("is asked for with no referrer and no credentials", () => {
    expect(draw()).toMatchObject({ referrerPolicy: "no-referrer", crossOrigin: "anonymous" });
  });

  it("keeps the address it is given", () => {
    expect(draw()).toMatchObject({ src: "https://cdn.example.com/me.png" });
  });
});
