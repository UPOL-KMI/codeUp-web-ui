"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { useToast } from "@/components/toast/toast-provider";
import { Button, type ButtonSize, type ButtonVariant } from "@/components/button";

/**
 * Copies a value to the clipboard and says so, for the short moment that is useful.
 *
 * **It never replaces showing the value.** `navigator.clipboard` needs a secure context and the
 * reader's permission, and either can be absent — so whatever this sits beside stays selectable,
 * and a refusal is a toast telling them to copy it by hand rather than a dead button.
 */
export function CopyButton({
  value,
  label,
  variant = "outline",
  size = "xs",
  className = "",
}: {
  value: string;
  /** What is being copied, for a screen reader: the visible word is only ever "Copy". */
  label?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  const t = useTranslations("Copy");
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => void (timer.current !== null && clearTimeout(timer.current)), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t("failed"));
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      aria-label={label}
      onClick={() => void copy()}
    >
      {copied ? t("copied") : t("copy")}
    </Button>
  );
}
