import { describe, expect, it } from "vitest";

import { parsePipelineStructure, serializePipelineStructure } from "./structure-file";
import type { PipelineStructure } from "./types";

/**
 * G-017. The file format is the interoperability contract with the legacy frontend, so what these
 * pin is mostly *what is accepted*: a file the old app wrote must load here, and a file this app
 * writes must be loadable there.
 */
const structure: PipelineStructure = {
  boxes: [
    {
      name: "source",
      type: "file-in",
      portsIn: [],
      portsOut: { in: { type: "file", value: "src" } },
    },
    {
      name: "run",
      type: "elf-exec",
      portsIn: { binary: { type: "file", value: "src" } },
      portsOut: { output: { type: "file", value: "out" } },
    },
  ],
  variables: [
    { name: "src", type: "file", value: "main.c" },
    { name: "args", type: "string[]", value: ["-a", "-b"] },
  ],
};

describe("serializePipelineStructure", () => {
  it("writes the legacy file shape, four-space indented", () => {
    const text = serializePipelineStructure(structure);
    expect(text.startsWith("{\n    ")).toBe(true);
    expect(Object.keys(JSON.parse(text) as object)).toEqual(["boxes", "variables"]);
  });

  it("writes an empty port map as an object, not the array core-api sends", () => {
    // core-api's PHP encodes an empty map as `[]`; a file carrying that where an importer expects
    // an object is a needless difference between two instances.
    const written = JSON.parse(serializePipelineStructure(structure)) as {
      boxes: { portsIn: unknown }[];
    };
    expect(written.boxes[0]!.portsIn).toEqual({});
    expect(Array.isArray(written.boxes[0]!.portsIn)).toBe(false);
  });

  it("round-trips through the parser unchanged", () => {
    const result = parsePipelineStructure(serializePipelineStructure(structure));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // `portsIn: []` normalises to `{}` on the way out, which is the same graph.
    expect(result.structure.variables).toEqual(structure.variables);
    expect(result.structure.boxes[1]).toEqual(structure.boxes[1]);
    expect(result.structure.boxes[0]!.portsIn).toEqual({});
  });
});

describe("parsePipelineStructure", () => {
  it("ignores unknown top-level keys, because legacy's export carries them", () => {
    // Legacy writes `{...pipeline.pipeline, boxes, variables}`, so a file from an instance whose
    // structure has extra keys must still load rather than being refused as foreign.
    const text = JSON.stringify({ boxes: [], variables: [], somethingElse: 42 });
    const result = parsePipelineStructure(text);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.structure).toEqual({ boxes: [], variables: [] });
  });

  it("accepts an empty port map as `[]`, which is what PHP sends", () => {
    const text = JSON.stringify({
      boxes: [{ name: "b", type: "t", portsIn: [], portsOut: [] }],
      variables: [],
    });
    const result = parsePipelineStructure(text);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.structure.boxes[0]).toEqual({
      name: "b",
      type: "t",
      portsIn: {},
      portsOut: {},
    });
  });

  it("fills in a missing variable value with the empty form for its type", () => {
    const text = JSON.stringify({
      boxes: [],
      variables: [
        { name: "s", type: "string" },
        { name: "a", type: "string[]" },
      ],
    });
    const result = parsePipelineStructure(text);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.structure.variables[0]!.value).toBe("");
      expect(result.structure.variables[1]!.value).toEqual([]);
    }
  });

  it("refuses rather than repairs, which is legacy's own choice", () => {
    // Legacy repairs the structure and then rejects the file if repairing changed anything, so a
    // half-loaded pipeline is never handed back. These are the cases that trips.
    const cases: [string, string][] = [
      ["notJson", "{ not json"],
      ["notAnObject", JSON.stringify([1, 2])],
      ["notAnObject", JSON.stringify("a string")],
      ["boxesNotAnArray", JSON.stringify({ boxes: {}, variables: [] })],
      ["variablesNotAnArray", JSON.stringify({ boxes: [], variables: {} })],
      ["badBox", JSON.stringify({ boxes: [{ type: "t" }], variables: [] })],
      ["badBox", JSON.stringify({ boxes: [{ name: 1, type: "t" }], variables: [] })],
      ["badBox", JSON.stringify({ boxes: [null], variables: [] })],
      [
        "badPort",
        JSON.stringify({
          boxes: [{ name: "b", type: "t", portsIn: { p: { type: "file" } } }],
          variables: [],
        }),
      ],
      [
        "badPort",
        JSON.stringify({
          boxes: [{ name: "b", type: "t", portsIn: { p: { type: "file", value: 7 } } }],
          variables: [],
        }),
      ],
      ["badVariable", JSON.stringify({ boxes: [], variables: [{ name: "v" }] })],
      ["badVariable", JSON.stringify({ boxes: [], variables: [{ name: "v", type: "s", value: 7 }] })],
    ];

    for (const [reason, text] of cases) {
      const result = parsePipelineStructure(text);
      expect(result.ok, `expected ${reason} for ${text.slice(0, 60)}`).toBe(false);
      if (!result.ok) expect(result.reason, `for ${text.slice(0, 60)}`).toBe(reason);
    }
  });

  it("does not let a non-empty array of ports through as an empty map", () => {
    // `portsIn: [{...}]` is a real structure error, not PHP's empty-object encoding.
    const text = JSON.stringify({
      boxes: [{ name: "b", type: "t", portsIn: [{ type: "file", value: "x" }] }],
      variables: [],
    });
    const result = parsePipelineStructure(text);
    expect(result.ok).toBe(false);
  });
});
