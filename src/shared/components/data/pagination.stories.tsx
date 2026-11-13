import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { Pagination } from "./pagination";

const meta = {
  title: "Data/Pagination",
  component: Pagination,
  tags: ["autodocs"],
  argTypes: { hrefOf: { control: false } },
  args: {
    page: 2,
    totalPages: 5,
    hrefOf: (page: number) => (page === 1 ? "/projects" : `/projects?page=${page}`),
    label: "Page 2 of 5",
    previousLabel: "Previous page",
    nextLabel: "Next page",
  },
  parameters: {
    // The links are those of the app: Storybook has no router, and mounts a stand-in for the stories that say they use the App Router.
    nextjs: { appDirectory: true, navigation: { pathname: "/projects" } },
  },
} satisfies Meta<typeof Pagination>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Where the person is, and a link to the page before and to the one after: links, so that a page can be shared and reached
 * with the back button. The links are those of the app, which carry the language of the page.
 */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText("Page 2 of 5")).toBeVisible();
    await expect(canvas.getByRole("link", { name: "Previous page" })).toHaveAttribute("href", "/en/projects");
    await expect(canvas.getByRole("link", { name: "Next page" })).toHaveAttribute("href", "/en/projects?page=3");
  },
};

/** The first page has no link back, and no page in its address. */
export const FirstPage: Story = {
  args: { page: 1, label: "Page 1 of 5" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.queryByRole("link", { name: "Previous page" })).not.toBeInTheDocument();
    await expect(canvas.getByRole("link", { name: "Next page" })).toHaveAttribute("href", "/en/projects?page=2");
  },
};

/** The last page has no link on. A link is absent at its end of the list, not disabled: there is nothing to press. */
export const LastPage: Story = {
  args: { page: 5, label: "Page 5 of 5" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.queryByRole("link", { name: "Next page" })).not.toBeInTheDocument();
    await expect(canvas.getByRole("link", { name: "Previous page" })).toHaveAttribute("href", "/en/projects?page=4");
  },
};

/** A list that fits one page draws no foot. */
export const OnePage: Story = {
  args: { page: 1, totalPages: 1, label: "Page 1 of 1" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByText("Page 1 of 1")).not.toBeInTheDocument();
  },
};

/** French runs longer: the label and the links wrap under each other before they leave the row. */
export const French: Story = {
  globals: { locale: "fr" },
  args: { label: "Page 2 sur 5", previousLabel: "Page précédente", nextLabel: "Page suivante" },
  decorators: [
    (Story) => (
      <div className="max-w-xs">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole("link", { name: "Page précédente" })).toBeVisible();
    await expect(canvas.getByRole("link", { name: "Page suivante" })).toBeVisible();
  },
};
