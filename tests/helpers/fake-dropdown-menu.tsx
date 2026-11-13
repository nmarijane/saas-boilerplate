import type { ReactElement, ReactNode } from "react";
import { Children, cloneElement, isValidElement } from "react";

// A stand-in for the dropdown menu primitives (ui/dropdown-menu.tsx). Radix draws
// the content of a menu in a portal, which a static render leaves out: here every
// part is drawn where it is written, so that a test reads what a menu holds, and
// can call what its rows do. A test points `vi.mock` at this module for the path
// of the primitives, and reads `rows` and `groups`, which every render fills.

interface Props {
  children?: ReactNode;
  className?: string;
  [prop: string]: unknown;
}

/** A row of the menu, in the order it is drawn: its words, and what choosing it does. */
export const rows: { label: string; onSelect?: (event: Event) => void }[] = [];

/** A group of radio rows: what it holds, what it says is chosen, and what choosing another does. */
export const groups: {
  value: string;
  items: string[];
  onValueChange: (value: string) => void;
}[] = [];

/** Forgets the rows and the groups of the last render: call it before each one. */
export function reset(): void {
  rows.length = 0;
  groups.length = 0;
}

/** The words inside a node, in order. An icon, a tile and a component with no children have none. */
function wordsOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(wordsOf).join("");
  }
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return wordsOf(node.props.children);
  }

  return "";
}

export function DropdownMenu({ children }: Props) {
  return <div data-fake="dropdown-menu">{children}</div>;
}

/** The app gives every trigger `asChild`: the trigger is the button itself. */
export function DropdownMenuTrigger({ children }: Props) {
  return children;
}

export function DropdownMenuContent({
  children,
  side: _side,
  align: _align,
  sideOffset: _sideOffset,
  ...props
}: Props) {
  return (
    <div role="menu" {...props}>
      {children}
    </div>
  );
}

export function DropdownMenuItem({
  asChild,
  children,
  onSelect,
  variant: _variant,
  inset: _inset,
  ...props
}: Props & { asChild?: boolean; onSelect?: (event: Event) => void }) {
  rows.push({ label: wordsOf(children), onSelect });

  if (asChild && isValidElement(children)) {
    return cloneElement(children as ReactElement<Props>, {
      role: "menuitem",
      ...props,
    });
  }

  return (
    <div role="menuitem" {...props}>
      {children}
    </div>
  );
}

export function DropdownMenuLabel({ children, inset: _inset, ...props }: Props) {
  return <div {...props}>{children}</div>;
}

export function DropdownMenuSeparator() {
  return <div role="separator" />;
}

export function DropdownMenuSub({ children }: Props) {
  return <div data-fake="submenu">{children}</div>;
}

export function DropdownMenuSubTrigger({ children, inset: _inset, ...props }: Props) {
  rows.push({ label: wordsOf(children) });

  return (
    <div role="menuitem" aria-haspopup="menu" {...props}>
      {children}
    </div>
  );
}

export function DropdownMenuSubContent({ children, ...props }: Props) {
  return (
    <div role="menu" data-fake="submenu-content" {...props}>
      {children}
    </div>
  );
}

export function DropdownMenuRadioGroup({
  children,
  value,
  onValueChange,
}: Props & { value: string; onValueChange: (value: string) => void }) {
  groups.push({
    value,
    onValueChange,
    items: Children.toArray(children).map((child) =>
      isValidElement<{ value?: string }>(child) ? (child.props.value ?? "") : "",
    ),
  });

  return (
    <div role="group" data-value={value}>
      {children}
    </div>
  );
}

export function DropdownMenuRadioItem({ children, value, ...props }: Props & { value: string }) {
  return (
    <div role="menuitemradio" data-value={value} {...props}>
      {children}
    </div>
  );
}
