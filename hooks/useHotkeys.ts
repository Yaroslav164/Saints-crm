"use client";

import { useEffect, useRef } from "react";

/**
 * Single-key shortcuts for the list screens (`n` for a new bundle, `/` for the search
 * field). Two rules make this safe to keep mounted on a page:
 *
 * - nothing fires while a modifier is held or while the caret is in a field, because typing
 *   "n" into a note must never open a modal;
 * - nothing fires while a dialog is open. A modal moves focus to its content, not into an
 *   input, so the check above would let `n` through and stack a second dialog on the first.
 *
 * The map is kept in a ref so adding a key does not rebind the listener on every render.
 */
export function useHotkeys(map: Record<string, () => void>): void {
  const handlers = useRef(map);

  // Updated after commit, not during render: a ref written in the render body is what the
  // React compiler rules flag, because the value a render sees would then depend on order.
  useEffect(() => {
    handlers.current = map;
  }, [map]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      if (target?.isContentEditable) return;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (document.querySelector('[role="dialog"]')) return;

      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      const handler = handlers.current[key];
      if (!handler) return;

      event.preventDefault();
      handler();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
