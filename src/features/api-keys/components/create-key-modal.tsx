"use client";

import type { FormEvent } from "react";
import type { CreateKey, CreateKeyOutcome } from "../key-flows";
import { useFormatter, useTranslations } from "next-intl";
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
import { createApiKeyAction } from "../actions";
import { earliestEnd, startOfDay } from "../expiry";
import { createKeyFlow, earliestAfter } from "../key-flows";
import { KEY_NAME_MAX } from "../limits";

// What a key can be allowed to do, in the order it is offered. `label` is the
// name of the message that says it (`apiKeys.dialog.scope.<label>`), and the
// wildcard is every scope at once. A key starts with all of them, as it always did.
const SCOPES = [
  { id: "read", label: "read" },
  { id: "write", label: "write" },
  { id: "admin", label: "admin" },
  { id: "*", label: "all" },
] as const;

interface CreateKeyFormViewProps {
  name: string;
  scopes: string[];
  /** What the date field holds: `2026-12-31`, or nothing. */
  expires: string;
  /** The first day a key can end on, as a date field holds it: the field offers no earlier one. */
  earliestEnd: string;
  /** The creation is running: the fields wait, and so does the button. */
  pending: boolean;
  /** The end that was typed is not after today: said under the field, as nothing was sent. */
  endPast: boolean;
  /**
   * The server refused the end, in these words (its clock is not the page's, near
   * midnight UTC): said under the field in place of ours, as it names the day that
   * the server takes.
   */
  endRefused?: string;
  /** The server refused, or did not answer: what was typed is kept, and the dialog says so. */
  failed: boolean;
  onNameChange: (name: string) => void;
  onScopeToggle: (scope: string) => void;
  onExpiresChange: (expires: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

// What is in the dialog while the key is made, as a function of the state it is
// given (as the form of a project is): a refusal of the server cannot be
// produced in a story, so the view is what a story and a test draw. It needs the
// context of a dialog for its header and its Cancel button. The name is
// required, the scopes are a group that needs one box ticked, and the end of the
// key is for those who want one: from tomorrow on, as a key that ends today is over
// before it is used (the field offers no earlier day, and the form says so under
// it when one is typed). The fields are read-only while it sends, not disabled: a
// disabled field drops the focus, which a failure should find where it was. Create
// waits for a name and a scope, shows that it works by loading, and keeps the
// focus. The error is an alert, above the button just pressed.
export function CreateKeyFormView({
  name,
  scopes,
  expires,
  earliestEnd,
  pending,
  endPast,
  endRefused,
  failed,
  onNameChange,
  onScopeToggle,
  onExpiresChange,
  onSubmit,
}: CreateKeyFormViewProps) {
  const t = useTranslations("apiKeys.dialog");
  const tCommon = useTranslations("common");
  const format = useFormatter();
  const nameId = useId();
  const expiresId = useId();

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>{t("title")}</DialogTitle>
        <DialogDescription>{t("description")}</DialogDescription>
      </DialogHeader>
      <DialogBody>
        <Field label={t("name")} htmlFor={nameId} required>
          <Input
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder={t("namePlaceholder")}
            maxLength={KEY_NAME_MAX}
            readOnly={pending}
            autoComplete="off"
            className="min-h-11"
          />
        </Field>
        <fieldset className="min-w-0">
          <legend className="mb-3 text-body leading-5 font-medium">
            {t("scopes")}
          </legend>
          <div className="grid grid-cols-2 gap-x-3 gap-y-3">
            {SCOPES.map(({ id, label }) => (
              <Label key={id} className="text-body leading-5 font-normal">
                <Checkbox
                  checked={scopes.includes(id)}
                  onCheckedChange={() => onScopeToggle(id)}
                  disabled={pending}
                />
                {t(`scope.${label}`)}
              </Label>
            ))}
          </div>
        </fieldset>
        <Field
          label={t("expires")}
          htmlFor={expiresId}
          hint={t("expiresHint")}
          error={
            endRefused ??
            (endPast
              ? t("expiresPast", {
                  // The day is the start of that day in UTC, which is what the server takes it for: read in UTC too, or a page west of Greenwich is told the day before
                  date: format.dateTime(startOfDay(earliestEnd), {
                    dateStyle: "long",
                    timeZone: "UTC",
                  }),
                })
              : undefined)
          }
        >
          <Input
            type="date"
            value={expires}
            min={earliestEnd}
            onChange={(event) => onExpiresChange(event.target.value)}
            readOnly={pending}
            className="min-h-11"
          />
        </Field>
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
          disabled={name.trim() === "" || scopes.length === 0}
        >
          {t("submit")}
        </Button>
      </DialogFooter>
    </form>
  );
}

// What is in the dialog once the key exists: the key itself, which is told this
// once, with the button that copies it, and Done. It is the only place the key
// is ever drawn: the server keeps a hash of it and nothing else.
export function CreatedKeyView({ secret }: { secret: string }) {
  const t = useTranslations("apiKeys.dialog");
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

interface CreateKeyContentProps {
  orgId: string;
  create: CreateKey;
  pending: boolean;
  onPendingChange: (pending: boolean) => void;
  /** Tells the dialog whether the key is on screen: a click beside the dialog must not discard it. */
  onRevealedChange: (revealed: boolean) => void;
}

// What was typed, and the key once it exists, live here, with the content,
// which Radix unmounts when the dialog closes: a dialog that opens again starts
// with an empty form and no key, however it was closed (Done, Cancel, Escape, a
// click outside). The key is in no other state, and is not kept anywhere
// else. Whether the creation is running lives outside, with the dialog, which
// cannot be dismissed while it is: a key made while the dialog is gone would be
// one nobody has seen. A second submit waits for the first (a flag that is read
// at once, not the state, which is only seen at the next render: two submits in
// the same turn would both be sent). The dialog is told when the key comes on
// screen, and when it goes (the content is unmounted with the dialog, which says
// it is gone as it goes). The first day a key can end on is told when the dialog
// opens, which is on the client, by the clock of the person; the flow tells it
// again when the key is asked for, as the dialog may stay open past midnight: an
// end that is refused then names the day it was checked against, and the field
// offers that day.
function CreateKeyContent({
  orgId,
  create,
  pending,
  onPendingChange,
  onRevealedChange,
}: CreateKeyContentProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>(["*"]);
  const [expires, setExpires] = useState("");
  const [earliest, setEarliest] = useState(() => earliestEnd(new Date()));
  const [endPast, setEndPast] = useState(false);
  const [endRefused, setEndRefused] = useState<string>();
  const [failed, setFailed] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const sending = useRef(false);

  useEffect(() => {
    onRevealedChange(secret !== null);
    return () => onRevealedChange(false);
  }, [secret, onRevealedChange]);

  if (secret !== null) {
    return <CreatedKeyView secret={secret} />;
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (sending.current || name.trim() === "" || scopes.length === 0) {
      return;
    }

    sending.current = true;
    onPendingChange(true);
    setEndPast(false);
    setEndRefused(undefined);
    setFailed(false);
    let result: CreateKeyOutcome = { outcome: "failed" };
    try {
      result = await createKeyFlow(
        { create, refresh: () => router.refresh(), now: () => new Date() },
        { orgId, name, scopes, expires },
      );
    } finally {
      sending.current = false;
      onPendingChange(false);
    }

    if (result.outcome === "created") {
      setSecret(result.key);
    } else {
      // The day it was checked against: the dialog may have stayed open across midnight (UTC), and then the day it
      // offered when it opened is one that is refused. The message names this day, and the field offers it.
      setEarliest((current) => earliestAfter(current, result));
      setEndPast(result.outcome === "past");
      setEndRefused(result.outcome === "refused" ? result.error : undefined);
      setFailed(result.outcome === "failed");
    }
  };

  return (
    <CreateKeyFormView
      name={name}
      scopes={scopes}
      expires={expires}
      earliestEnd={earliest}
      pending={pending}
      endPast={endPast}
      endRefused={endRefused}
      failed={failed}
      onNameChange={(next) => {
        setName(next);
        setFailed(false);
      }}
      onScopeToggle={(scope) => {
        setScopes((current) =>
          current.includes(scope)
            ? current.filter((entry) => entry !== scope)
            : [...current, scope],
        );
        setFailed(false);
      }}
      onExpiresChange={(next) => {
        setExpires(next);
        setEndPast(false);
        setEndRefused(undefined);
        setFailed(false);
      }}
      onSubmit={submit}
    />
  );
}

interface CreateKeyModalProps {
  /** The workspace the key is for: the page takes it from the session. */
  orgId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Called when the dialog has closed, to say where the focus goes. Radix gives
   * it back to the `Trigger` of a dialog, and this one has none (what opens it
   * is the button of the header, a long way from it in the markup): left to
   * Radix the focus is dropped on the page body (WCAG 2.4.3). The handler gets
   * the event Radix waits on, and calls `preventDefault` on it, then focuses
   * the opener.
   */
  onCloseAutoFocus?: (event: Event) => void;
  /**
   * Makes the key on the server. The page gives nothing, and the action is
   * called; a story, which has no server, gives one that answers by itself.
   */
  create?: CreateKey;
}

// The dialog that creates an API key: a name, what it may do and, if it has
// an end, when. Once the key exists it shows it, once, to be copied. A failure
// stays in the dialog, where the person can try again. While the key is on screen
// a click beside the dialog does nothing: it would discard a key that cannot be
// shown again, with no warning. Escape and Done close it, as they are meant to.
export function CreateKeyModal({
  orgId,
  open,
  onOpenChange,
  onCloseAutoFocus,
  create = createApiKeyAction,
}: CreateKeyModalProps) {
  const [pending, setPending] = useState(false);
  // Read when a click lands beside the dialog, never drawn: a flag, not a state.
  const revealed = useRef(false);
  const setRevealed = useCallback((shown: boolean) => {
    revealed.current = shown;
  }, []);

  return (
    <Dialog open={open} onOpenChange={whileConfirming(pending, onOpenChange)}>
      <DialogContent
        size="sm"
        onCloseAutoFocus={onCloseAutoFocus}
        onInteractOutside={(event) => {
          if (revealed.current) {
            event.preventDefault();
          }
        }}
      >
        <CreateKeyContent
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
