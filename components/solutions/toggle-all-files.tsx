"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";

import { buttonClasses } from "@/components/button";

/**
 * "Expand all" / "Collapse all" over the submitted files (S-017).
 *
 * **It sets `open` on the `<details>` elements directly, and that is the right tool here.** Those
 * elements are rendered on the server, they hold no React state, and their open-ness belongs to
 * the browser -- keyboard toggling, find-in-page, the disclosure triangle. Lifting it into React
 * would mean a client component wrapping every file *and* the highlighted tokens inside it, which
 * is the largest thing on the page and the one worth never shipping to the client. So this reaches
 * for the elements by their `data-source-file` marker instead. Nothing else on the page reads or
 * writes that attribute.
 *
 * **It also repairs the file index.** Those links jump to `#a-file`, and a link into a collapsed
 * `<details>` scrolls nowhere in browsers without the auto-expanding behaviour -- so a reader who
 * collapsed everything and then used the index above would click into silence. Opening the target
 * on `hashchange` costs six lines and keeps the two features from cancelling each other out.
 */
export function ToggleAllFiles() {
  const t = useTranslations("Sources");

  useEffect(() => {
    function openTarget() {
      const id = window.location.hash.slice(1);
      if (!id) return;
      const target = document.getElementById(decodeURIComponent(id));
      if (target instanceof HTMLDetailsElement) target.open = true;
    }
    openTarget();
    window.addEventListener("hashchange", openTarget);
    return () => window.removeEventListener("hashchange", openTarget);
  }, []);

  const setAll = (open: boolean) => {
    for (const element of document.querySelectorAll<HTMLDetailsElement>(
      "details[data-source-file]",
    )) {
      element.open = open;
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={() => setAll(true)} className={buttonClasses("outline", "xs")}>
        {t("expandAll")}
      </button>
      <button
        type="button"
        onClick={() => setAll(false)}
        className={buttonClasses("outline", "xs")}
      >
        {t("collapseAll")}
      </button>
    </div>
  );
}
