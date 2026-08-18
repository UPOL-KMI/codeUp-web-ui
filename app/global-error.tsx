"use client";

// Catches errors in the root layout itself (app/[locale]/layout.tsx, including
// NextIntlClientProvider/ThemeProvider) -- the one place next-intl can't be trusted, since the
// failure might be *in* the provider that makes it work. Must define its own <html>/<body> and
// doesn't get global styles or the app theme (Next's own docs: "global-error ... render their
// own document"), so kept deliberately dependency-free. Hardcoded bilingual text is the pragmatic
// exception to "no hardcoded user-facing strings" here -- the normal i18n machinery is exactly
// what may have just failed.
export default function GlobalError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
        <h1>Something went wrong / Něco se pokazilo</h1>
        <button onClick={() => retry()}>Try again / Zkusit znovu</button>
      </body>
    </html>
  );
}
