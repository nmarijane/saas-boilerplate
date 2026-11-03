import { CircleAlertIcon } from "lucide-react";
import * as React from "react";

import { Label } from "@/shared/components/ui/label";
import { cn } from "@/shared/utils/cn";

/** What the field hands to its control. */
interface ControlProps {
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: React.AriaAttributes["aria-invalid"];
  "aria-required"?: React.AriaAttributes["aria-required"];
}

interface FieldProps {
  label: string;
  /** The id of the control: the label points at it, and the hint and the error build on it. */
  htmlFor: string;
  hint?: string;
  /** Marks the control invalid and announces the message. */
  error?: string;
  /** Adds a visual asterisk, and `aria-required` on the control for assistive technology. */
  required?: boolean;
  className?: string;
  /** One control: an Input, a Textarea, the SelectTrigger... that takes these props. */
  children: React.ReactElement<ControlProps>;
}

// The label above, the hint and the error below, all tied to the control the
// field clones. The error is a role="alert" paragraph, so it is announced when
// it shows up after a submit.
function Field({
  label,
  htmlFor,
  hint,
  error,
  required = false,
  className,
  children,
}: FieldProps) {
  // A string or `false` is no control: it is rendered as it is.
  const control = React.isValidElement<ControlProps>(children)
    ? children
    : null;
  const hintId = hint ? `${htmlFor}-hint` : undefined;
  const errorId = error ? `${htmlFor}-error` : undefined;
  const describedBy = [control?.props["aria-describedby"], hintId, errorId]
    .filter(Boolean)
    .join(" ");

  // Only what the field has to say: an explicit `undefined` would replace what
  // the control sets for itself (a required Select puts `aria-required` on its trigger).
  const overrides: ControlProps = { id: htmlFor };
  if (describedBy) {
    overrides["aria-describedby"] = describedBy;
  }
  if (error) {
    overrides["aria-invalid"] = true;
  }
  if (required) {
    overrides["aria-required"] = true;
  }

  return (
    <div data-slot="field" className={cn("grid gap-1.5", className)}>
      <Label htmlFor={htmlFor} className="block leading-5">
        {label}
        {required ? (
          <span aria-hidden="true" className="ml-1 text-muted-foreground">
            *
          </span>
        ) : null}
      </Label>
      {control ? React.cloneElement(control, overrides) : children}
      {hint ? (
        <p id={hintId} className="text-meta text-ink-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p
          id={errorId}
          role="alert"
          className="flex items-start gap-1.5 text-meta text-danger-text"
        >
          <CircleAlertIcon
            aria-hidden="true"
            className="mt-px size-4 shrink-0"
          />
          {error}
        </p>
      ) : null}
    </div>
  );
}

export { Field };
