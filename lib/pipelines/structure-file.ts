import {
  isArrayType,
  ports as portsObject,
  type PipelineBox,
  type PipelinePort,
  type PipelineStructure,
  type PipelineVariable,
} from "./types";

/**
 * A pipeline's structure as a file (G-017), so a definition can move between instances or be
 * edited outside the app.
 *
 * **The file format is the legacy app's**, deliberately, because interoperability is the whole
 * point: a `pipeline.json` exported from the old frontend imports here and vice versa. That means
 * `{boxes, variables}` at the top level, 4-space indented, and **unknown top-level keys are
 * ignored on import rather than rejected** -- legacy exports `{...pipeline.pipeline, boxes,
 * variables}`, so a file from an instance whose structure carries extra keys must still load.
 *
 * **Import is strict about what it does read**, mirroring legacy's `checkPipelineStructure`: that
 * function repairs a malformed structure and legacy then compares the result by identity and
 * refuses the file if anything was repaired. The same choice is made here for the same reason --
 * silently dropping a box or a port from somebody's definition would hand them a pipeline that
 * looks imported and is not. Unlike legacy, the refusal says which part failed.
 */
const INDENT = 4;

export function serializePipelineStructure(structure: PipelineStructure): string {
  return JSON.stringify(
    {
      boxes: structure.boxes.map((box) => ({
        name: box.name,
        type: box.type,
        // `ports()` from `./types`: an empty port map arrives from core-api as `[]` (PHP), and a
        // file that carried `[]` where an importer expects an object is a needless difference.
        portsIn: portsObject(box.portsIn),
        portsOut: portsObject(box.portsOut),
      })),
      variables: structure.variables,
    },
    undefined,
    INDENT,
  );
}

export type ParseResult =
  { ok: true; structure: PipelineStructure } | { ok: false; reason: ParseFailure };

/** Which check failed, so the screen can say something better than "invalid file". */
export type ParseFailure =
  | "notJson"
  | "notAnObject"
  | "boxesNotAnArray"
  | "variablesNotAnArray"
  | "badBox"
  | "badPort"
  | "badVariable";

export function parsePipelineStructure(text: string): ParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: "notJson" };
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { ok: false, reason: "notAnObject" };
  }

  const record = parsed as Record<string, unknown>;
  if (!Array.isArray(record.boxes)) return { ok: false, reason: "boxesNotAnArray" };
  if (!Array.isArray(record.variables)) return { ok: false, reason: "variablesNotAnArray" };

  const boxes: PipelineBox[] = [];
  for (const candidate of record.boxes) {
    const box = readBox(candidate);
    if (box === "badPort") return { ok: false, reason: "badPort" };
    if (box === null) return { ok: false, reason: "badBox" };
    boxes.push(box);
  }

  const variables: PipelineVariable[] = [];
  for (const candidate of record.variables) {
    const variable = readVariable(candidate);
    if (variable === null) return { ok: false, reason: "badVariable" };
    variables.push(variable);
  }

  return { ok: true, structure: { boxes, variables } };
}

/** Legacy's `checkBoxStructure`: `name` and `type` are strings, and both port maps are objects
 *  whose every entry has a string `type` and a string `value`. */
function readBox(candidate: unknown): PipelineBox | null | "badPort" {
  if (typeof candidate !== "object" || candidate === null) return null;
  const box = candidate as Record<string, unknown>;
  if (typeof box.name !== "string" || typeof box.type !== "string") return null;

  const portsIn = readPorts(box.portsIn);
  const portsOut = readPorts(box.portsOut);
  if (portsIn === null || portsOut === null) return "badPort";

  return { name: box.name, type: box.type, portsIn, portsOut };
}

function readPorts(candidate: unknown): Record<string, PipelinePort> | null {
  // An absent or empty port map is legitimate -- `[]` is what PHP encodes an empty one as.
  if (candidate === undefined || candidate === null) return {};
  if (Array.isArray(candidate)) return candidate.length === 0 ? {} : null;
  if (typeof candidate !== "object") return null;

  const ports: Record<string, PipelinePort> = {};
  for (const [name, value] of Object.entries(candidate as Record<string, unknown>)) {
    if (typeof value !== "object" || value === null) return null;
    const port = value as Record<string, unknown>;
    if (typeof port.type !== "string" || typeof port.value !== "string") return null;
    ports[name] = { type: port.type, value: port.value };
  }
  return ports;
}

/** Legacy's `checkVariableStructure`, plus the `value` this app's editor needs: a variable's value
 *  is a string or an array of them, and an absent one becomes the empty form for its type. */
function readVariable(candidate: unknown): PipelineVariable | null {
  if (typeof candidate !== "object" || candidate === null) return null;
  const variable = candidate as Record<string, unknown>;
  if (typeof variable.name !== "string" || typeof variable.type !== "string") return null;

  const value = variable.value;
  if (typeof value === "string") return { name: variable.name, type: variable.type, value };
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
    return { name: variable.name, type: variable.type, value: value as string[] };
  }
  if (value === undefined || value === null) {
    return {
      name: variable.name,
      type: variable.type,
      value: isArrayType(variable.type) ? [] : "",
    };
  }
  return null;
}
