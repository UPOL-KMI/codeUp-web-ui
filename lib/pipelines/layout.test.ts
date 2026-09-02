import { describe, expect, it } from "vitest";

import { layoutPipeline } from "./layout";
import { renderPipelineSvg } from "./svg";
import { utilization, type PipelineBox, type PipelineVariable } from "./types";

/** Source -> run -> judge, wired the way core-api wires a pipeline: by variable name. */
const BOXES: PipelineBox[] = [
  {
    name: "source",
    type: "file-in",
    portsIn: [],
    portsOut: { input: { type: "file", value: "source-file" } },
  },
  {
    name: "run",
    type: "elf-exec",
    portsIn: {
      binary: { type: "file", value: "source-file" },
      "entry-point": { type: "string", value: "entry-point" },
    },
    portsOut: { stdout: { type: "file", value: "actual-output" } },
  },
  {
    name: "judge",
    type: "judge",
    portsIn: { actual: { type: "file", value: "actual-output" } },
    portsOut: [],
  },
];

const VARIABLES: PipelineVariable[] = [
  { name: "source-file", type: "file", value: "" },
  { name: "entry-point", type: "string", value: "$entry-point" },
  { name: "actual-output", type: "file", value: "out.txt" },
  { name: "args", type: "string[]", value: ["-a", "-b", "-c", "-d", "-e"] },
];

describe("utilization", () => {
  it("derives the edges the payload does not state", () => {
    expect(utilization(BOXES)["source-file"]).toEqual({
      portsIn: [{ box: "run", port: "binary" }],
      portsOut: [{ box: "source", port: "input" }],
    });
  });

  it("reads an empty port list in either shape core-api sends", () => {
    expect(utilization([{ name: "x", type: "t", portsIn: [], portsOut: {} }])).toEqual({});
  });

  it("ignores a port wired to nothing", () => {
    expect(
      utilization([
        { name: "x", type: "t", portsIn: { a: { type: "file", value: "" } }, portsOut: [] },
      ]),
    ).toEqual({});
  });
});

describe("layoutPipeline", () => {
  const layout = layoutPipeline(BOXES, VARIABLES);
  const node = (id: string) => layout.nodes.find((entry) => entry.id === id)!;

  it("places a node below everything that feeds it", () => {
    expect(node("box:source").layer).toBe(0);
    expect(node("box:run").layer).toBeGreaterThan(node("box:source").layer);
    // `actual-output` holds a value, so it is a node between `run` and `judge`.
    expect(node("var:actual-output").layer).toBeGreaterThan(node("box:run").layer);
    expect(node("box:judge").layer).toBeGreaterThan(node("var:actual-output").layer);
    expect(node("box:source").y).toBeLessThan(node("box:run").y);
  });

  it("draws a variable that holds something and not one that only wires two boxes", () => {
    const names = layout.nodes.filter((entry) => entry.kind !== "box").map((entry) => entry.name);
    expect(names.sort()).toEqual(["actual-output", "args", "entry-point"]);
    // The wiring variable became a labelled edge instead.
    const wire = layout.edges.find((edge) => edge.label === "source-file")!;
    expect(wire.from).toEqual({ node: "box:source", port: "input" });
    expect(wire.to).toEqual({ node: "box:run", port: "binary" });
  });

  it("marks an external reference as its own kind, because a missing one is how a pipeline breaks", () => {
    expect(node("var:entry-point").kind).toBe("reference");
    expect(node("var:actual-output").kind).toBe("variable");
  });

  it("cuts a long list off rather than drawing a column of text", () => {
    expect(node("var:args").detail).toBe("-a, -b, -c, …");
  });

  it("anchors an edge on the port it belongs to, not on the middle of the box", () => {
    const run = node("box:run");
    const binary = run.inputs.find((entry) => entry.port === "binary")!;
    const entry = run.inputs.find((entry) => entry.port === "entry-point")!;
    expect(binary.offset).not.toBe(entry.offset);

    const wire = layout.edges.find((edge) => edge.label === "source-file")!;
    expect(wire.x2).toBeCloseTo(run.x + binary.offset);
    expect(wire.y2).toBe(run.y);
  });

  it("gives a wider box to a longer name", () => {
    const [narrow] = layoutPipeline(
      [{ name: "a", type: "t", portsIn: [], portsOut: [] }],
      [],
    ).nodes;
    const [wide] = layoutPipeline(
      [{ name: "a-very-long-box-name-indeed", type: "t", portsIn: [], portsOut: [] }],
      [],
    ).nodes;
    expect(wide!.width).toBeGreaterThan(narrow!.width);
  });

  it("terminates on a cycle instead of looping for ever", () => {
    const cyclic: PipelineBox[] = [
      {
        name: "a",
        type: "t",
        portsIn: { i: { type: "file", value: "y" } },
        portsOut: { o: { type: "file", value: "x" } },
      },
      {
        name: "b",
        type: "t",
        portsIn: { i: { type: "file", value: "x" } },
        portsOut: { o: { type: "file", value: "y" } },
      },
    ];
    const looped = layoutPipeline(cyclic, []);
    expect(looped.nodes).toHaveLength(2);
    expect(looped.edges).toHaveLength(2);
  });

  it("is big enough to hold everything it placed", () => {
    for (const entry of layout.nodes) {
      expect(entry.x + entry.width).toBeLessThanOrEqual(layout.width);
      expect(entry.y + entry.height).toBeLessThanOrEqual(layout.height);
    }
  });
});

describe("renderPipelineSvg", () => {
  const layout = layoutPipeline(BOXES, VARIABLES);
  const svg = renderPipelineSvg(layout, { title: "Test pipeline" });

  it("is one self-contained svg with a viewBox that matches the layout", () => {
    expect(svg.startsWith("<svg ")).toBe(true);
    expect(svg).toContain(`viewBox="0 0 ${Math.round(layout.width)} ${Math.round(layout.height)}"`);
    expect(svg).toContain('aria-label="Test pipeline"');
  });

  it("names every node so a click can be attributed without parsing titles", () => {
    for (const node of layout.nodes) expect(svg).toContain(`data-name="${node.name}"`);
    expect(svg).toContain('data-kind="reference"');
  });

  it("draws each port's own label", () => {
    expect(svg).toContain(">binary<");
    expect(svg).toContain(">entry-point<");
  });

  it("takes its colours from the theme rather than baking them in", () => {
    expect(svg).toContain("currentColor");
    expect(svg).not.toMatch(/#[0-9a-f]{6}/i);
  });

  it("escapes a name that would otherwise close a tag", () => {
    const nasty = layoutPipeline(
      [{ name: "</text><script>x</script>", type: "t&t", portsIn: [], portsOut: [] }],
      [],
    );
    const rendered = renderPipelineSvg(nasty);
    expect(rendered).not.toContain("<script>");
    expect(rendered).toContain("&lt;/text&gt;");
    expect(rendered).toContain("t&amp;t");
  });

  it("marks the selected node", () => {
    const selected = renderPipelineSvg(layout, { selected: "run" });
    expect(selected).toContain("var(--color-primary, currentColor)");
  });
});

describe("ordering within a layer", () => {
  it("fans producers out in the order their wires arrive at the consumer's ports", () => {
    // Three sources feeding one box, declared in the reverse of the port order.
    const boxes: PipelineBox[] = [
      {
        name: "third",
        type: "file-in",
        portsIn: [],
        portsOut: { o: { type: "file", value: "c" } },
      },
      {
        name: "second",
        type: "file-in",
        portsIn: [],
        portsOut: { o: { type: "file", value: "b" } },
      },
      {
        name: "first",
        type: "file-in",
        portsIn: [],
        portsOut: { o: { type: "file", value: "a" } },
      },
      {
        name: "sink",
        type: "exec",
        portsIn: {
          p1: { type: "file", value: "a" },
          p2: { type: "file", value: "b" },
          p3: { type: "file", value: "c" },
        },
        portsOut: [],
      },
    ];

    const layout = layoutPipeline(boxes, []);
    const sources = layout.nodes
      .filter((node) => node.name !== "sink")
      .sort((a, b) => a.x - b.x)
      .map((node) => node.name);
    // Without the port term every producer would score identically and keep its declared order.
    expect(sources).toEqual(["first", "second", "third"]);
  });
});
