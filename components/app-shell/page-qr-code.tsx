"use client";

import { QRCodeSVG } from "qrcode.react";
import { useTranslations } from "next-intl";

import { Dialog, DialogContent } from "@/components/dialog/dialog";

/**
 * The current page as a QR code (G-025) -- how a lecturer puts the page on the projector onto the
 * phones in the room.
 *
 * Needs no API call and no session: the whole input is the address, which is why this is the one
 * piece of the shell that is purely a browser concern. It is loaded on first open rather than with
 * the shell (see `sidebar-nav.tsx`), for the same reason the command palette is.
 *
 * `url` is captured by the trigger at the moment of the click rather than read here, which is
 * both what keeps this component pure and what makes it correct: it stays mounted after its first
 * open, so anything it read once would go stale the moment the reader navigated.
 *
 * **The colours are deliberately fixed rather than themed, and the margin is deliberately set
 * (DEC-127).** This is a machine-readable image, not decoration.
 */
export function PageQrCode({
  url,
  open,
  onOpenChange,
}: {
  url: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("Nav.qr");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={t("title")} description={t("explain")} className="items-center">
        <div className="rounded-md bg-white p-3">
          {/* `role="img"` with the title: an inline `<svg>` carrying a `<title>` but no role is
              announced inconsistently across screen readers, and this one has a name worth
              reading -- it is the only thing in the dialog that is not text. */}
          <QRCodeSVG
            value={url}
            size={224}
            level="M"
            marginSize={4}
            bgColor="#ffffff"
            fgColor="#000000"
            role="img"
            title={t("imageTitle")}
          />
        </div>
        {/* The address in text as well, because a camera that will not focus is common and the
            legacy dropdown showed it too -- and because it is the only way to check that the
            code encodes the page you think it does. */}
        <code className="w-full text-center text-xs break-all text-muted-foreground">{url}</code>
      </DialogContent>
    </Dialog>
  );
}
