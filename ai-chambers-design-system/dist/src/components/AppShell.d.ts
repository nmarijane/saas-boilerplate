import { type ReactNode } from "react";
export interface NavGroup {
    label: string;
    items: {
        label: string;
        href: string;
    }[];
}
export declare const workspaceNav: NavGroup[];
export declare function AppShell({ children, workspace, nav, current, theme, onThemeChange, }: {
    children: ReactNode;
    workspace: string;
    nav?: NavGroup[];
    current: string;
    theme: "light" | "dark";
    onThemeChange: () => void;
}): import("react").JSX.Element;
