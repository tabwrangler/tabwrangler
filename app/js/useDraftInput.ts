import { useEffect, useRef, useState } from "react";

/**
 * Manages a number input's editing lifecycle so the user can freely edit the raw text (including
 * clearing the field) without the reactive value clobbering the input mid-edit. The committed value
 * is written on blur or after the user stops typing for `commitDelay` ms.
 */
export default function useDraftInput(
  value: number,
  onCommit: (value: number) => boolean | void,
  commitDelay = 1000,
) {
  const [draft, setDraft] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timeoutRef.current != null) clearTimeout(timeoutRef.current);
    },
    [],
  );

  function commit(raw: string | null) {
    if (timeoutRef.current != null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    const parsed = Math.max(0, parseInt(raw ?? "") || 0);
    if (draft !== null && parsed !== value) {
      if (onCommit(parsed) === false) return;
    }
    setDraft(null);
  }

  return {
    onBlur() {
      commit(draft);
    },
    onChange(e: React.ChangeEvent<HTMLInputElement>) {
      const raw = e.target.value;
      setDraft(raw);
      if (timeoutRef.current != null) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => commit(raw), commitDelay);
    },
    onFocus(e: React.FocusEvent<HTMLInputElement>) {
      setDraft(String(value));
      e.target.select();
    },
    value: draft ?? String(value),
  };
}
