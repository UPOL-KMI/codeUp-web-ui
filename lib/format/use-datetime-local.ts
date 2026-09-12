"use client";

import { useEffect, useRef, useState } from "react";

import { toDateTimeLocal } from "./datetime-local";

/**
 * A `datetime-local` field's own state, seeded **after mount** (PF-020).
 *
 * `toDateTimeLocal` reads `getHours()`, and a client component is rendered on the server too --
 * where that is the container's zone, not the reader's. Seeding the state directly therefore ships
 * HTML carrying one time and hydrates it into another: a mismatch, which footgun 6 calls an error,
 * and a moment in which a teacher is shown a deadline that is not theirs.
 *
 * So the field starts empty, which is true in every zone, and takes its value in the effect. The
 * seeding runs once: the parent re-renders after a save (`router.refresh()`), and re-applying the
 * saved value then would discard whatever the reader has typed since.
 */
export function useDateTimeLocalField(
  unixSeconds: number | null,
): [string, (value: string) => void] {
  const [value, setValue] = useState("");
  const seeded = useRef(false);

  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    setValue(unixSeconds === null ? "" : toDateTimeLocal(unixSeconds));
  }, [unixSeconds]);

  return [value, setValue];
}
