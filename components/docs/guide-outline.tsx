import type { OutlineEntry } from "@/lib/docs/outline";

export function GuideOutline({
  entries,
  label,
  className = "",
}: {
  entries: OutlineEntry[];
  label: string;
  className?: string;
}) {
  if (entries.length < 2) return null;

  return (
    <nav aria-label={label} className={`text-sm ${className}`}>
      <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <ol className="flex flex-col">
        {entries.map((entry) => (
          <li key={entry.id}>
            <a
              href={`#${entry.id}`}
              className={`block border-l-2 border-border py-1 text-muted-foreground transition-colors hover:border-primary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
                entry.depth === 3 ? "pl-6" : "pl-3"
              }`}
            >
              {entry.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
