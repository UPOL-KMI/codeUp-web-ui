import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

import { InfLogo } from "./inf-logo";

/**
 * The mark, the product's name and whose it is -- one link, the same in the sidebar and above
 * every anonymous page, so a reader always knows which deployment they are on.
 */
export function BrandMark({ href, compact = false }: { href: string; compact?: boolean }) {
  const t = useTranslations("Nav.brand");

  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <InfLogo className={compact ? "h-7 w-auto" : "h-9 w-auto"} />
      <span className="flex flex-col leading-tight">
        <span className="text-base font-semibold tracking-tight text-foreground">
          {t("product")}
        </span>
        {!compact && (
          <span className="text-[0.6875rem] font-medium tracking-wide text-primary uppercase">
            {t("department")}
          </span>
        )}
      </span>
    </Link>
  );
}
