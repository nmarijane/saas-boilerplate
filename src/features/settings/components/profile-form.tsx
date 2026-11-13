"use client";

import type { FormEvent } from "react";
import { useTranslations } from "next-intl";
import { unstable_rethrow } from "next/navigation";
import { useId, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Field } from "@/shared/components/ui/field";
import { InlineStatus } from "@/shared/components/ui/inline-status";
import { Input } from "@/shared/components/ui/input";
import { PageAlert } from "@/shared/components/ui/page-alert";
import { useRouter } from "@/shared/lib/i18n-navigation";
import { isAvatarUrl } from "@/shared/utils/avatar-url";
import { editing } from "@/shared/utils/helpers";
import { reportHandledError } from "@/shared/utils/report-error";
import { updateProfile } from "../actions";

/** The length the server accepts for a name, from 1 to this. */
const NAME_MAX = 100;

/** Whether a link can be an avatar: an `https:` address, which the browser fetches (the server checks it again). */
export function isAvatarLink(link: string): boolean {
  return isAvatarUrl(link);
}

interface ProfileFormViewProps {
  name: string;
  email: string;
  image: string;
  /** A save is running: the fields wait, read-only, and so does the button. */
  pending: boolean;
  /** The last save worked: a status says so next to the button. */
  saved: boolean;
  /** The last save did not work: what was typed is kept, and an alert says so. */
  failed: boolean;
  /** The link of the avatar is not one: said under the field, as nothing was sent. */
  imageInvalid: boolean;
  onNameChange: (name: string) => void;
  onImageChange: (image: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

// The fields of the profile, as a function of the state it is given (as the form
// of a project is), so that a story and a test can draw a save that worked or
// that did not. The name is required and stops at what the server accepts. The
// email is shown and not editable here, read-only rather than disabled so that it
// can be reached, read and copied, on a quiet tint so that it does not look like a
// field to fill; its hint says why. The fields are read-only
// while the form saves, not disabled: a disabled field drops the focus, which a
// failure should find where it was. Save shows that it works by loading, and is
// disabled only while the name is empty. The error is an alert and the success a
// status, announced when they show up; the indicator of a save running is the
// button's, never doubled.
export function ProfileFormView({
  name,
  email,
  image,
  pending,
  saved,
  failed,
  imageInvalid,
  onNameChange,
  onImageChange,
  onSubmit,
}: ProfileFormViewProps) {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const nameId = useId();
  const emailId = useId();
  const imageId = useId();

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <Field label={t("name")} htmlFor={nameId} required>
        <Input
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          maxLength={NAME_MAX}
          readOnly={pending}
          autoComplete="name"
          className="min-h-11"
        />
      </Field>
      <Field label={t("email")} htmlFor={emailId} hint={t("emailHint")}>
        <Input
          type="email"
          value={email}
          readOnly
          autoComplete="email"
          className="min-h-11 cursor-default bg-muted/50"
        />
      </Field>
      <Field
        label={t("avatar")}
        htmlFor={imageId}
        hint={t("avatarHint")}
        error={imageInvalid ? t("avatarInvalid") : undefined}
      >
        <Input
          type="url"
          inputMode="url"
          value={image}
          onChange={(event) => onImageChange(event.target.value)}
          placeholder={t("avatarPlaceholder")}
          readOnly={pending}
          autoComplete="off"
          className="min-h-11"
        />
      </Field>
      {failed ? <PageAlert tone="danger">{t("saveFailed")}</PageAlert> : null}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <Button type="submit" loading={pending} disabled={name.trim() === ""}>
          {tCommon("save")}
        </Button>
        {saved ? <InlineStatus state="success">{t("saved")}</InlineStatus> : null}
      </div>
    </form>
  );
}

interface ProfileFormProps {
  defaultValues: {
    name: string;
    email: string;
    image: string | null;
  };
}

// The form of the profile, with what it holds now. Saving reads the page again,
// so that the account menu and the rest of the shell, which read the person from
// the session, tell the new name and picture.
export function ProfileForm({ defaultValues }: ProfileFormProps) {
  const router = useRouter();
  const [name, setName] = useState(defaultValues.name);
  const [image, setImage] = useState(defaultValues.image ?? "");
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [failed, setFailed] = useState(false);
  const [imageInvalid, setImageInvalid] = useState(false);

  const forget = () => {
    setSaved(false);
    setFailed(false);
    setImageInvalid(false);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const link = image.trim();
    if (pending || name.trim() === "") {
      return;
    }
    // An empty link takes the picture away; anything else has to be an address
    if (link !== "" && !isAvatarLink(link)) {
      setImageInvalid(true);
      return;
    }

    setPending(true);
    forget();
    let ok = false;
    try {
      ok = (await updateProfile({ name: name.trim(), image: link })).success;
      if (ok) {
        router.refresh();
      }
    } catch (error) {
      unstable_rethrow(error);
      // Handled with the alert below, not hidden: the error reporter of the app still hears it.
      reportHandledError(error);
    } finally {
      setPending(false);
    }
    setSaved(ok);
    setFailed(!ok);
  };

  return (
    <ProfileFormView
      name={name}
      email={defaultValues.email}
      image={image}
      pending={pending}
      saved={saved}
      failed={failed}
      imageInvalid={imageInvalid}
      onNameChange={editing(setName, forget)}
      onImageChange={editing(setImage, forget)}
      onSubmit={submit}
    />
  );
}
