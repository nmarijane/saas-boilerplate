import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Button } from "./button";
import { toast, Toaster } from "./sonner";

const meta = {
  title: "UI/Toast",
  component: Toaster,
  tags: ["autodocs"],
  argTypes: {
    position: {
      control: "select",
      options: [
        "top-left",
        "top-center",
        "top-right",
        "bottom-left",
        "bottom-center",
        "bottom-right",
      ],
    },
  },
  args: { position: "bottom-right" },
} satisfies Meta<typeof Toaster>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * One button per toast. A success and an information leave after 6 seconds, an
 * undo after 10, and an error stays until it is closed. Hover or focus a toast
 * to keep it; press Alt+T to reach them from the keyboard.
 */
export const Playground: Story = {
  render: (args) => (
    <>
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => toast.success("Changes saved")}>Success</Button>
        <Button
          variant="destructive"
          onClick={() =>
            toast.error("Could not save your changes", {
              description: "Check your connection, then try again.",
            })
          }
        >
          Error
        </Button>
        <Button
          variant="outline"
          onClick={() => toast.info("A new version is available")}
        >
          Info
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            toast.undo("Project deleted", () => toast.success("Project restored"))
          }
        >
          Undo
        </Button>
      </div>
      <Toaster {...args} />
    </>
  ),
};

/** French runs longer: the message wraps, and the buttons keep their place. */
export const LongMessages: Story = {
  render: (args) => (
    <>
      <div className="flex flex-wrap gap-3">
        <Button
          variant="destructive"
          onClick={() =>
            toast.error("Impossible d'enregistrer les modifications du profil", {
              description:
                "Votre connexion a été interrompue pendant l'envoi. Vérifiez-la, puis réessayez dans quelques instants.",
            })
          }
        >
          Erreur
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            toast.undo(
              "Le projet et tout son historique ont été supprimés",
              () => undefined,
            )
          }
        >
          Annuler
        </Button>
      </div>
      <Toaster {...args} />
    </>
  ),
};
