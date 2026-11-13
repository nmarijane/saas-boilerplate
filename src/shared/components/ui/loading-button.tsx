"use client";

import * as React from "react";

/**
 * The click handler of a button that may be loading. A loading button is still
 * in the page and still has the focus, so a click reaches it: it takes the
 * click and does nothing with it. The handler of the caller does not run, and
 * cancelling the click is what keeps a submit button from sending its form
 * (the Enter key of a field clicks it too).
 */
function clickWhileLoading(
  loading: boolean,
  onClick: React.MouseEventHandler<HTMLButtonElement> | undefined,
): React.MouseEventHandler<HTMLButtonElement> | undefined {
  if (!loading) {
    return onClick;
  }

  return (event) => {
    event.preventDefault();
  };
}

// The button of a `Button` that was given `loading`, and the one place where
// the click of a loading button is held. Holding it takes a function, and a
// function cannot cross from a Server Component to the page (React throws "Event
// handlers cannot be passed to Client Component props"). `Button` has no
// directive, as it is rendered from both sides, so it must hand the page data
// only: the function is made here, on the client, from the `loading` flag and
// the `className`, `children` and attributes that `Button` computed.
// It is the one element of a button that can load, loading or not: a different
// type between the two states would make React replace the node, and the focus
// of the one who pressed the button would be lost as it starts to load.
// It is a detail of `Button`: render `<Button loading={...}>`, not this.
function LoadingButton({
  loading,
  onClick,
  ...props
}: React.ComponentProps<"button"> & { loading: boolean }) {
  return (
    <button
      {...props}
      data-loading={loading ? "" : undefined}
      aria-disabled={loading || props["aria-disabled"]}
      onClick={clickWhileLoading(loading, onClick)}
    />
  );
}

export { clickWhileLoading, LoadingButton };
