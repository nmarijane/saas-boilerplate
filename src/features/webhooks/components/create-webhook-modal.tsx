"use client";

import type { FormEvent } from "react";
import type { CreateEndpoint, CreateEndpointOutcome } from "../endpoint-flows";
import type { EventName } from "@/features/events/types";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { whileConfirming } from "@/shared/components/ui/confirm-dialog";
import { CopyCode } from "@/shared/components/ui/copy-code";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { PageAlert } from "@/shared/components/ui/page-alert";
import { useRouter } from "@/shared/lib/i18n-navigation";
import { createWebhookEndpointAction } from "../actions";
import { AVAILABLE_EVENTS } from "../available-events";
import { createEndpointFlow } from "../endpoint-flows";

interface CreateEndpointFormViewProps {
  url: string;
  events: EventName[];
  /** The addition is running: the fields wait, and so does the button. */
  pending: boolean;
  /** The address is not a web address: said under the field, as nothing was sent. */
  invalid: boolean;
  /** The server refused, or did not answer: what was typed is kept, and the dialog says so. */
  failed: boolean;
  onUrlChange: (url: string) => void;
  onEventToggle: (event: EventName) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

// What is in the dialog while the endpoint is added, as a function of the state
// it is given (as the form of a project is): a refusal of the server cannot be
// produced in a story, so the view is what a story and a test draw. It needs the
// context of a dialog for its header and its Cancel button. The form checks the
// address itself (`noValidate` leaves the browser's bubble out, which speaks the
// language of the browser, not of the page). The events are a group that needs
// one box ticked. The fields are read-only while it sends, not disabled: a
// disabled field drops the focus, which a failure should find where it was. Add
// waits for an address and an event, shows that it works by loading, and keeps
// the focus. The error is an alert, above the button just pressed.
export function CreateEndpointFormView({
  url,
  events,
  pending,
  invalid,
  failed,
  onUrlChange,
  onEventToggle,
  onSubmit,
}: CreateEndpointFormViewProps) {
  const t = useTranslations("webhooks.dialog");
  const tEvent = useTranslations("webhooks.event");
  const tCommon = useTranslations("common");
  const urlId = useId();

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>{t("title")}</DialogTitle>
        <DialogDescription>{t("description")}</DialogDescription>
      </DialogHeader>
      <DialogBody>
        <Field
          label={t("url")}
          htmlFor={urlId}
          required
          error={invalid ? t("urlInvalid") : undefined}
        >
          <Input
            type="url"
            inputMode="url"
            value={url}
            onChange={(event) => onUrlChange(event.target.value)}
            placeholder={t("urlPlaceholder")}
            readOnly={pending}
            autoComplete="off"
            className="min-h-11"
          />
        </Field>
        <fieldset className="min-w-0">
          <legend className="mb-3 text-body leading-5 font-medium">
            {t("events")}
          </legend>
          <div className="grid grid-cols-1 gap-x-3 gap-y-3 sm:grid-cols-2">
            {AVAILABLE_EVENTS.map((name) => (
              <Label key={name} className="text-body leading-5 font-normal">
                <Checkbox
                  checked={events.includes(name)}
                  onCheckedChange={() => onEventToggle(name)}
                  disabled={pending}
                />
                {tEvent(name)}
              </Label>
            ))}
          </div>
        </fieldset>
        {failed ? <PageAlert tone="danger">{t("failed")}</PageAlert> : null}
      </DialogBody>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline" disabled={pending}>
            {tCommon("cancel")}
          </Button>
        </DialogClose>
        <Button
          type="submit"
          loading={pending}
          disabled={url.trim() === "" || events.length === 0}
        >
          {t("submit")}
        </Button>
      </DialogFooter>
    </form>
  );
}

// What is in the dialog once the endpoint exists: its signing secret, which is
// told this once, with the button that copies it, and Done. It is the only
// place the secret is ever drawn: the list never reads it back.
export function CreatedEndpointView({ secret }: { secret: string }) {
  const t = useTranslations("webhooks.dialog");
  const tCommon = useTranslations("common");

  return (
    <div className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>{t("createdTitle")}</DialogTitle>
        <DialogDescription>{t("copyNow")}</DialogDescription>
      </DialogHeader>
      <DialogBody>
        <CopyCode value={secret} autoFocus />
      </DialogBody>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button">{tCommon("done")}</Button>
        </DialogClose>
      </DialogFooter>
    </div>
  );
}

interface CreateEndpointContentProps {
  orgId: string;
  create: CreateEndpoint;
  pending: boolean;
  onPendingChange: (pending: boolean) => void;
  /** Tells the dialog whether the secret is on screen: a click beside the dialog must not discard it. */
  onRevealedChange: (revealed: boolean) => void;
}

// What was typed, and the secret once the endpoint exists, live here, with the
// content, which Radix unmounts when the dialog closes: a dialog that opens
// again starts with an empty form and no secret, however it was closed (Done,
// Cancel, Escape, a click outside). The secret is in no other state. Whether
// the addition is running lives outside, with the dialog, which cannot be
// dismissed while it is: an endpoint added while the dialog is gone would be one
// whose secret nobody has seen. A second submit waits for the first (a flag that
// is read at once, not the state, which is only seen at the next render: two
// submits in the same turn would both be sent). The dialog is told when the
// secret comes on screen, and when it goes (the content is unmounted with the
// dialog, which says it is gone as it goes).
function CreateEndpointContent({
  orgId,
  create,
  pending,
  onPendingChange,
  onRevealedChange,
}: CreateEndpointContentProps) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<EventName[]>([]);
  const [invalid, setInvalid] = useState(false);
  const [failed, setFailed] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const sending = useRef(false);

  useEffect(() => {
    onRevealedChange(secret !== null);
    return () => onRevealedChange(false);
  }, [secret, onRevealedChange]);

  if (secret !== null) {
    return <CreatedEndpointView secret={secret} />;
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (sending.current || url.trim() === "" || events.length === 0) {
      return;
    }

    sending.current = true;
    onPendingChange(true);
    setInvalid(false);
    setFailed(false);
    let result: CreateEndpointOutcome = { outcome: "failed" };
    try {
      result = await createEndpointFlow(
        { create, refresh: () => router.refresh() },
        { orgId, url, events },
      );
    } finally {
      sending.current = false;
      onPendingChange(false);
    }

    if (result.outcome === "created") {
      setSecret(result.secret);
    } else {
      setInvalid(result.outcome === "invalid");
      setFailed(result.outcome === "failed");
    }
  };

  return (
    <CreateEndpointFormView
      url={url}
      events={events}
      pending={pending}
      invalid={invalid}
      failed={failed}
      onUrlChange={(next) => {
        setUrl(next);
        setInvalid(false);
        setFailed(false);
      }}
      onEventToggle={(name) => {
        setEvents((current) =>
          current.includes(name)
            ? current.filter((entry) => entry !== name)
            : [...current, name],
        );
        setFailed(false);
      }}
      onSubmit={submit}
    />
  );
}

interface CreateWebhookModalProps {
  /** The workspace the endpoint is for: the page takes it from the session. */
  orgId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Called when the dialog has closed, to say where the focus goes. Radix gives
   * it back to the `Trigger` of a dialog, and this one has none (what opens it
   * is the button of the section, a long way from it in the markup): left to
   * Radix the focus is dropped on the page body (WCAG 2.4.3). The handler gets
   * the event Radix waits on, and calls `preventDefault` on it, then focuses
   * the opener.
   */
  onCloseAutoFocus?: (event: Event) => void;
  /**
   * Adds the endpoint on the server. The page gives nothing, and the action is
   * called; a story, which has no server, gives one that answers by itself.
   */
  create?: CreateEndpoint;
}

// The dialog that adds a webhook endpoint: where to send, and which events. Once
// the endpoint exists it shows its signing secret, once, to be copied. An address
// that is not a web address, and a failure, stay in the dialog, where the person
// can fix them or try again. While the secret is on screen a click beside the
// dialog does nothing: it would discard a secret that cannot be shown again, with
// no warning. Escape and Done close it, as they are meant to.
export function CreateWebhookModal({
  orgId,
  open,
  onOpenChange,
  onCloseAutoFocus,
  create = createWebhookEndpointAction,
}: CreateWebhookModalProps) {
  const [pending, setPending] = useState(false);
  // Read when a click lands beside the dialog, never drawn: a flag, not a state.
  const revealed = useRef(false);
  const setRevealed = useCallback((shown: boolean) => {
    revealed.current = shown;
  }, []);

  return (
    <Dialog open={open} onOpenChange={whileConfirming(pending, onOpenChange)}>
      <DialogContent
        onCloseAutoFocus={onCloseAutoFocus}
        onInteractOutside={(event) => {
          if (revealed.current) {
            event.preventDefault();
          }
        }}
      >
        <CreateEndpointContent
          orgId={orgId}
          create={create}
          pending={pending}
          onPendingChange={setPending}
          onRevealedChange={setRevealed}
        />
      </DialogContent>
    </Dialog>
  );
}
