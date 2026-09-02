/**
 * A pipeline as core-api stores it (T-013..T-016), confirmed live.
 *
 * A pipeline is a **dataflow graph**: boxes are operations, and they are wired to each other not
 * by edges but by *names*. A box's port carries the name of a variable, and two boxes are
 * connected precisely when one's output port and another's input port name the same variable.
 * Nothing in the payload says "box A connects to box B" -- that has to be derived, which is what
 * `utilization()` does and why every screen here shares one derivation rather than each computing
 * its own.
 *
 * `portsIn` and `portsOut` arrive as an **object keyed by port name**, except when they are empty,
 * where PHP's json encoding makes them `[]` rather than `{}`. Both shapes are read here.
 */
export interface PipelinePort {
  type: string;
  /** The variable this port is wired to; empty when the port is unconnected. */
  value: string;
}

export interface PipelineBox {
  name: string;
  type: string;
  portsIn: Record<string, PipelinePort> | never[];
  portsOut: Record<string, PipelinePort> | never[];
}

export interface PipelineVariable {
  name: string;
  type: string;
  value: string | string[];
}

export interface PipelineStructure {
  boxes: PipelineBox[];
  variables: PipelineVariable[];
}

export interface PipelineDetail {
  id: string;
  name: string;
  version: number;
  description: string;
  createdAt: number;
  updatedAt: number;
  author: string | null;
  authorName: string | null;
  forkedFrom: string | null;
  pipeline: PipelineStructure;
  parameters: Record<string, boolean>;
  runtimeEnvironmentIds: string[];
  supplementaryFilesIds: string[];
  can: Record<string, boolean>;
}

/**
 * A box *type* the instance offers, as `/v1/pipelines/boxes` describes it: `name` is the readable
 * one ("Input File"), `type` is the identifier a box stores (`file-in`), and the ports are the
 * shape a new box of that type starts with -- names and data types, values blank.
 */
export interface BoxType {
  name: string;
  type: string;
  portsIn: Record<string, PipelinePort> | never[];
  portsOut: Record<string, PipelinePort> | never[];
}

/** The data types a pipeline variable may have, and the arrays of each. */
export const SCALAR_TYPES = ["file", "remote-file", "string"] as const;
export const VARIABLE_TYPES = [
  ...SCALAR_TYPES,
  ...SCALAR_TYPES.map((type) => `${type}[]`),
] as string[];

export const isArrayType = (type: string) => type.endsWith("[]");

export function ports(value: PipelineBox["portsIn"]): Record<string, PipelinePort> {
  return Array.isArray(value) ? {} : value;
}

/** A value beginning with `$` is a **reference** to something outside the pipeline. */
export function isExternalReference(value: string | string[]): value is string {
  return typeof value === "string" && value.startsWith("$");
}

export interface VariableUtilization {
  /** Boxes whose input port reads this variable. */
  portsIn: { box: string; port: string }[];
  /** Boxes whose output port writes it. */
  portsOut: { box: string; port: string }[];
}

/**
 * Which boxes read and write each variable -- the edges of the graph, derived rather than stored.
 * The legacy `getVariablesUtilization`, and the single source every pipeline screen reads from.
 */
export function utilization(boxes: PipelineBox[]): Record<string, VariableUtilization> {
  const result: Record<string, VariableUtilization> = {};
  for (const box of boxes) {
    for (const side of ["portsIn", "portsOut"] as const) {
      for (const [port, definition] of Object.entries(ports(box[side]))) {
        const name = definition?.value;
        if (!name) continue;
        result[name] ??= { portsIn: [], portsOut: [] };
        result[name][side].push({ box: box.name, port });
      }
    }
  }
  return result;
}
