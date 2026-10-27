import { type ReactNode } from "react";
import { type ButtonProps } from "@patternfly/react-core";
export declare function ActionButton({ busy, children, ...props }: ButtonProps & {
    busy?: boolean;
}): import("react").JSX.Element;
export declare function PageHeader({ title, meta, actions, }: {
    title: string;
    meta?: ReactNode;
    actions?: ReactNode;
}): import("react").JSX.Element;
export declare function Field({ label, value, onChange, error, help, required, type, autoComplete, }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    error?: string;
    help?: string;
    required?: boolean;
    type?: "text" | "email" | "password";
    autoComplete?: string;
}): import("react").JSX.Element;
export type Tone = "neutral" | "success" | "warning" | "danger" | "info";
export declare function StatusPill({ children, tone, }: {
    children: ReactNode;
    tone?: Tone;
}): import("react").JSX.Element;
export declare function Inspector({ open, title, children, onClose, }: {
    open: boolean;
    title: string;
    children: ReactNode;
    onClose: () => void;
}): import("react").JSX.Element;
export declare function ActivityTimeline({ events, }: {
    events: {
        id: string;
        action: string;
        actor: string;
        at: string;
        detail?: string;
    }[];
}): import("react").JSX.Element;
