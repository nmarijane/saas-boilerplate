import type {ButtonProps} from "@patternfly/react-core";
import type {ReactNode} from "react";
import {
  
  FormGroup,
  HelperText,
  HelperTextItem,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Button as PFButton,
  Spinner,
  TextInput
} from "@patternfly/react-core";
import {  useId } from "react";
export function ActionButton({
  busy = false,
  children,
  ...props
}: ButtonProps & { busy?: boolean }) {
  return (
    <PFButton
      {...props}
      size="sm"
      className={`ac-button ${props.className ?? ""}`}
      isDisabled={busy || props.isDisabled}
      aria-busy={busy}
    >
      <span className={busy ? "ac-invisible" : undefined}>{children}</span>
      {busy && (
        <span className="ac-button-progress">
          <Spinner size="sm" aria-label="Working" />
        </span>
      )}
    </PFButton>
  );
}
export function PageHeader({
  title,
  meta,
  actions,
}: {
  title: string;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="ac-page-header">
      <div className="ac-inline">
        <h1>{title}</h1>
        {meta}
      </div>
      <div className="ac-inline">{actions}</div>
    </header>
  );
}
export function Field({
  label,
  value,
  onChange,
  error,
  help,
  required = false,
  type = "text",
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  help?: string;
  required?: boolean;
  type?: "text" | "email" | "password";
  autoComplete?: string;
}) {
  const id = useId();
  return (
    <FormGroup label={label} fieldId={id} isRequired={required}>
      <TextInput
        id={id}
        value={value}
        onChange={(_, v) => onChange(v)}
        type={type}
        required={required}
        autoComplete={autoComplete}
        validated={error ? "error" : "default"}
        aria-invalid={!!error}
        aria-describedby={error || help ? `${id}-help` : undefined}
      />
      {(error || help) && (
        <HelperText id={`${id}-help`}>
          <HelperTextItem variant={error ? "error" : "default"}>
            {error || help}
          </HelperTextItem>
        </HelperText>
      )}
    </FormGroup>
  );
}
export type Tone = "neutral" | "success" | "warning" | "danger" | "info";
export function StatusPill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return (
    <Label className={`ac-pill ac-pill-${tone}`} isCompact>
      {children}
    </Label>
  );
}
export function Inspector({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <Modal
      className="ac-overlay ac-inspector"
      isOpen={open}
      onClose={onClose}
      aria-labelledby="ac-inspector-title"
      variant="medium"
    >
      <ModalHeader title={title} labelId="ac-inspector-title" />
      <ModalBody>{children}</ModalBody>
      <ModalFooter>
        <ActionButton variant="secondary" onClick={onClose}>
          Close
        </ActionButton>
      </ModalFooter>
    </Modal>
  );
}
export function ActivityTimeline({
  events,
}: {
  events: {
    id: string;
    action: string;
    actor: string;
    at: string;
    detail?: string;
  }[];
}) {
  return (
    <ol className="ac-timeline">
      {events.map((e) => (
        <li key={e.id}>
          <strong>{e.action}</strong>
          <span>
            {e.actor} ·{" "}
            <time dateTime={e.at}>
              {new Intl.DateTimeFormat("en-AU", {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: "Australia/Perth",
              }).format(new Date(e.at))}{" "}
              AWST
            </time>
          </span>
          {e.detail && <p>{e.detail}</p>}
        </li>
      ))}
    </ol>
  );
}
