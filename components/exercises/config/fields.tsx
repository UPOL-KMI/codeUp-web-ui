"use client";

import { useFormContext } from "react-hook-form";
import { useTranslations } from "next-intl";

import type { ConfigValues } from "@/lib/actions/exercise-config.schema";
import type { FileEntry } from "@/lib/exercise-config/simple-config";

/**
 * The four repeated shapes of the per-test configuration form (T-009): a list of strings, a list
 * of the exercise's own files, a list of files each with the name it takes inside the sandbox, and
 * one such file on its own.
 *
 * All four are edited through `watch`/`setValue` rather than `useFieldArray`, which cannot key a
 * list of bare strings -- and mixing the two styles across one form is worse than picking the one
 * that covers every case here.
 *
 * **A file is chosen, never typed.** Every one of these values is a `remote-file`, which core-api
 * resolves against the exercise's own attached files; a typo becomes an evaluation that fails at
 * run time with nothing to point at. Uploading those files is T-023's, so an exercise with none
 * gets a select with nothing in it and a line saying where they come from.
 */
const INPUT =
  "rounded-md border border-input bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-ring";

type Path = string;

function useValue<T>(name: Path): [T, (value: T) => void] {
  const { watch, setValue } = useFormContext<ConfigValues>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- paths here are built from ids
  const value = watch(name as any) as T;
  const set = (next: T) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see above
    setValue(name as any, next as any, { shouldDirty: true });
  return [value, set];
}

export function FileSelect({
  name,
  label,
  files,
  readOnly,
  description,
}: {
  name: Path;
  label: string;
  files: string[];
  readOnly: boolean;
  description?: string;
}) {
  const t = useTranslations("ExerciseConfig.config");
  const [value, setValue] = useValue<string>(name);

  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <select
        className={INPUT}
        // The visible label wraps this control, and a wrapped `<select>` takes its whole label --
        // including every option's text -- as its accessible name. Naming it explicitly is what
        // makes a screen reader (and a test) hear "Expected output" rather than the option list.
        aria-label={label}
        disabled={readOnly}
        value={value ?? ""}
        onChange={(event) => setValue(event.target.value)}
      >
        <option value="">{t("noFile")}</option>
        {/* A file named in the configuration but no longer attached still has to be selectable,
            or opening the form and saving it would silently drop the reference. */}
        {(files.includes(value) || !value ? files : [value, ...files]).map((file) => (
          <option key={file} value={file}>
            {file}
          </option>
        ))}
      </select>
      {description && <span className="text-xs text-muted-foreground">{description}</span>}
    </label>
  );
}

export function StringListField({
  name,
  label,
  readOnly,
  description,
  placeholder,
}: {
  name: Path;
  label: string;
  readOnly: boolean;
  description?: string;
  placeholder?: string;
}) {
  const t = useTranslations("ExerciseConfig.config");
  const [value, setValue] = useValue<string[]>(name);
  const items = value ?? [];

  return (
    <div className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {items.map((item, index) => (
        <span key={index} className="flex items-center gap-1">
          <input
            type="text"
            className={`${INPUT} w-full font-mono`}
            aria-label={`${label} ${index + 1}`}
            placeholder={placeholder}
            disabled={readOnly}
            value={item}
            onChange={(event) =>
              setValue(items.map((entry, at) => (at === index ? event.target.value : entry)))
            }
          />
          {!readOnly && (
            <button
              type="button"
              aria-label={t("removeItem")}
              onClick={() => setValue(items.filter((_, at) => at !== index))}
              className="rounded-md border border-input px-2 py-1 text-xs hover:bg-muted"
            >
              &times;
            </button>
          )}
        </span>
      ))}
      {!readOnly && (
        <button
          type="button"
          onClick={() => setValue([...items, ""])}
          className="self-start rounded-md border border-input px-2 py-1 text-xs hover:bg-muted"
        >
          {t("addItem")}
        </button>
      )}
      {description && <span className="text-xs text-muted-foreground">{description}</span>}
    </div>
  );
}

export function FileListField({
  name,
  label,
  files,
  readOnly,
  description,
}: {
  name: Path;
  label: string;
  files: string[];
  readOnly: boolean;
  description?: string;
}) {
  const t = useTranslations("ExerciseConfig.config");
  const [value, setValue] = useValue<string[]>(name);
  const items = value ?? [];

  return (
    <div className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {items.map((item, index) => (
        <span key={index} className="flex items-center gap-1">
          <select
            className={`${INPUT} w-full`}
            aria-label={`${label} ${index + 1}`}
            disabled={readOnly}
            value={item}
            onChange={(event) =>
              setValue(items.map((entry, at) => (at === index ? event.target.value : entry)))
            }
          >
            <option value="">{t("noFile")}</option>
            {(files.includes(item) || !item ? files : [item, ...files]).map((file) => (
              <option key={file} value={file}>
                {file}
              </option>
            ))}
          </select>
          {!readOnly && (
            <button
              type="button"
              aria-label={t("removeItem")}
              onClick={() => setValue(items.filter((_, at) => at !== index))}
              className="rounded-md border border-input px-2 py-1 text-xs hover:bg-muted"
            >
              &times;
            </button>
          )}
        </span>
      ))}
      {!readOnly && (
        <button
          type="button"
          onClick={() => setValue([...items, ""])}
          className="self-start rounded-md border border-input px-2 py-1 text-xs hover:bg-muted"
        >
          {t("addItem")}
        </button>
      )}
      {description && <span className="text-xs text-muted-foreground">{description}</span>}
    </div>
  );
}

export function FilePairListField({
  name,
  label,
  files,
  readOnly,
  description,
}: {
  name: Path;
  label: string;
  files: string[];
  readOnly: boolean;
  description?: string;
}) {
  const t = useTranslations("ExerciseConfig.config");
  const [value, setValue] = useValue<FileEntry[]>(name);
  const items = value ?? [];

  return (
    <div className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {items.map((item, index) => (
        <span key={index} className="flex items-center gap-1">
          <select
            className={`${INPUT} min-w-0 flex-1`}
            aria-label={`${label} ${index + 1}`}
            disabled={readOnly}
            value={item.file}
            onChange={(event) =>
              setValue(
                items.map((entry, at) =>
                  at === index ? { ...entry, file: event.target.value } : entry,
                ),
              )
            }
          >
            <option value="">{t("noFile")}</option>
            {(files.includes(item.file) || !item.file ? files : [item.file, ...files]).map(
              (file) => (
                <option key={file} value={file}>
                  {file}
                </option>
              ),
            )}
          </select>
          <input
            type="text"
            className={`${INPUT} min-w-0 flex-1 font-mono`}
            aria-label={t("renamedTo", { label, index: index + 1 })}
            placeholder={t("sameName")}
            disabled={readOnly}
            value={item.name}
            onChange={(event) =>
              setValue(
                items.map((entry, at) =>
                  at === index ? { ...entry, name: event.target.value } : entry,
                ),
              )
            }
          />
          {!readOnly && (
            <button
              type="button"
              aria-label={t("removeItem")}
              onClick={() => setValue(items.filter((_, at) => at !== index))}
              className="rounded-md border border-input px-2 py-1 text-xs hover:bg-muted"
            >
              &times;
            </button>
          )}
        </span>
      ))}
      {!readOnly && (
        <button
          type="button"
          onClick={() => setValue([...items, { file: "", name: "" }])}
          className="self-start rounded-md border border-input px-2 py-1 text-xs hover:bg-muted"
        >
          {t("addItem")}
        </button>
      )}
      {description && <span className="text-xs text-muted-foreground">{description}</span>}
    </div>
  );
}
