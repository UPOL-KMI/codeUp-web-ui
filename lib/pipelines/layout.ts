import {
  isExternalReference,
  ports,
  utilization,
  type PipelineBox,
  type PipelineVariable,
} from "./types";

/**
 * Where every box and variable of a pipeline goes when it is drawn (T-014/T-016).
 *
 * A pipeline is a directed acyclic graph, and the only sensible way to read one is **top to
 * bottom in the order the data flows**. So this is a layered layout: each node is placed in the
 * layer one below the last of its producers, nodes within a layer are ordered to keep the wires
 * from crossing, and the result is a set of coordinates. Nothing here draws -- `svg.ts` does --
 * which is what makes the whole thing a pure function with a unit test rather than a picture
 * somebody has to look at to check.
 *
 * **A variable is a node only when it holds something.** One that merely carries data from one box
 * to another is an edge with a label, which is the legacy rule and the right one: drawing every
 * wire as a box would double the node count and say nothing.
 *
 * **Cycles are tolerated, not assumed away.** core-api validates that a pipeline is acyclic, but a
 * half-edited one read straight out of the structure editor need not be, and a layout that loops
 * for ever on it would be a worse failure than one that draws it slightly wrong. The layering
 * therefore visits each node once and leaves a back edge pointing upwards.
 */
export interface LayoutNode {
  id: string;
  kind: "box" | "variable" | "reference";
  /** The box or variable name -- what a click selects. */
  name: string;
  /** A box's type, or a variable's value; the second line of the label. */
  detail: string;
  x: number;
  y: number;
  width: number;
  height: number;
  layer: number;
  /** Input anchors along the top edge, in order, with their x offset from the node's left. */
  inputs: { port: string; offset: number }[];
  /** Output anchors along the bottom edge. */
  outputs: { port: string; offset: number }[];
}

export interface LayoutEdge {
  from: { node: string; port: string | null };
  to: { node: string; port: string | null };
  label: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface Layout {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  width: number;
  height: number;
}

const CHAR = 6.6;
const PADDING = 16;
const PORT_GAP = 58;
const MIN_WIDTH = 108;
const BOX_HEIGHT = 54;
const VARIABLE_HEIGHT = 38;
const LAYER_GAP = 96;
const NODE_GAP = 34;
const MARGIN = 18;

const textWidth = (value: string) => value.length * CHAR;

function shorten(value: string, limit = 28): string {
  return value.length > limit ? `${value.slice(0, limit - 1)}…` : value;
}

function variableLabel(value: string | string[]): string {
  if (Array.isArray(value)) {
    const shown = value.slice(0, 3).join(", ");
    return shorten(value.length > 3 ? `${shown}, …` : shown);
  }
  return shorten(value);
}

/**
 * The layer of each node, assigned **as late as possible**: a node sits one layer above the
 * earliest thing that consumes it.
 *
 * The obvious rule -- one below the deepest producer -- puts every source in layer 0, and a
 * ReCodEx pipeline is nearly all sources: a dozen `file-in` boxes feeding one execution box. That
 * draws a mile-wide row above a two-node column. Working back from the sinks instead lowers each
 * source until it is directly above whatever reads it, which is both narrower and the way somebody
 * reads the picture: *this* file goes into *that* box.
 *
 * Computed by relaxation with a pass bound rather than a topological sort, so a cycle -- which
 * core-api forbids but a half-edited structure can hold -- costs a wrong-looking edge and not a
 * hang.
 */
function assignLayers(nodeIds: string[], outgoing: Map<string, string[]>): Map<string, number> {
  const depth = new Map(nodeIds.map((id) => [id, 0]));
  for (let pass = 0; pass < nodeIds.length; pass++) {
    let moved = false;
    for (const id of nodeIds) {
      const consumers = outgoing.get(id) ?? [];
      const deepest = consumers.reduce((best, to) => Math.max(best, depth.get(to) ?? 0), -1);
      if (deepest + 1 > (depth.get(id) ?? 0)) {
        depth.set(id, deepest + 1);
        moved = true;
      }
    }
    if (!moved) break;
  }

  const deepest = Math.max(0, ...depth.values());
  return new Map(nodeIds.map((id) => [id, deepest - (depth.get(id) ?? 0)]));
}

/**
 * The order of nodes within each layer, by the barycentre rule: a node sits at the average
 * position of what it is connected to, and a few sweeps up and down settle it.
 *
 * The position it averages is **fractional, and includes the port**. Almost every box in a
 * ReCodEx pipeline feeds the same execution box, so ordering by the consumer *node* alone gives
 * every producer the identical key and leaves them in whatever order they arrived -- a row of
 * boxes whose wires cross each other on the way into one target. Adding the port's own position
 * within that box fans the producers out into the order their wires arrive in, which is the whole
 * difference between a readable picture and a hairball.
 */
interface OrderingEdge {
  from: string;
  to: string;
  /** Where the edge lands along the target's top edge, and leaves the source's bottom edge. */
  toFraction: number;
  fromFraction: number;
}

function orderLayers(layers: string[][], edges: OrderingEdge[]): void {
  const positions = new Map<string, number>();
  const record = () => {
    for (const layer of layers) layer.forEach((id, index) => positions.set(id, index));
  };
  record();

  const consumers = new Map<string, OrderingEdge[]>();
  const producers = new Map<string, OrderingEdge[]>();
  for (const edge of edges) {
    (consumers.get(edge.from) ?? consumers.set(edge.from, []).get(edge.from)!).push(edge);
    (producers.get(edge.to) ?? producers.set(edge.to, []).get(edge.to)!).push(edge);
  }

  for (let sweep = 0; sweep < 6; sweep++) {
    const downward = sweep % 2 === 0;
    const order = downward ? layers : [...layers].reverse();
    for (const layer of order) {
      const key = (id: string) => {
        const related = downward ? producers.get(id) : consumers.get(id);
        if (!related || related.length === 0) return positions.get(id) ?? 0;
        const total = related.reduce((sum, edge) => {
          const other = downward ? edge.from : edge.to;
          const fraction = downward ? edge.fromFraction : edge.toFraction;
          return sum + (positions.get(other) ?? 0) + fraction;
        }, 0);
        return total / related.length;
      };
      const keys = new Map(layer.map((id) => [id, key(id)]));
      layer.sort((a, b) => keys.get(a)! - keys.get(b)! || a.localeCompare(b));
    }
    record();
  }
}

export function layoutPipeline(boxes: PipelineBox[], variables: PipelineVariable[]): Layout {
  const used = utilization(boxes);
  const drawnVariables = variables.filter(
    (variable) => variable.value && (!Array.isArray(variable.value) || variable.value.length > 0),
  );
  const variableByName = new Map(drawnVariables.map((variable) => [variable.name, variable]));

  const nodes = new Map<string, LayoutNode>();

  for (const box of boxes) {
    const inputs = Object.keys(ports(box.portsIn));
    const outputs = Object.keys(ports(box.portsOut));
    const width = Math.max(
      MIN_WIDTH,
      textWidth(box.name) + PADDING * 2,
      textWidth(box.type) + PADDING * 2,
      Math.max(inputs.length, outputs.length) * PORT_GAP,
    );
    nodes.set(`box:${box.name}`, {
      id: `box:${box.name}`,
      kind: "box",
      name: box.name,
      detail: box.type,
      x: 0,
      y: 0,
      width,
      height: BOX_HEIGHT,
      layer: 0,
      inputs: inputs.map((port, index) => ({
        port,
        offset: ((index + 1) * width) / (inputs.length + 1),
      })),
      outputs: outputs.map((port, index) => ({
        port,
        offset: ((index + 1) * width) / (outputs.length + 1),
      })),
    });
  }

  for (const variable of drawnVariables) {
    const label = variableLabel(variable.value);
    nodes.set(`var:${variable.name}`, {
      id: `var:${variable.name}`,
      kind: isExternalReference(variable.value) ? "reference" : "variable",
      name: variable.name,
      detail: label,
      x: 0,
      y: 0,
      width: Math.max(
        MIN_WIDTH,
        textWidth(label) + PADDING * 2,
        textWidth(variable.name) + PADDING * 2,
      ),
      height: VARIABLE_HEIGHT,
      layer: 0,
      inputs: [],
      outputs: [],
    });
  }

  interface RawEdge {
    from: string;
    fromPort: string | null;
    to: string;
    toPort: string | null;
    label: string;
  }
  const rawEdges: RawEdge[] = [];
  for (const [name, entry] of Object.entries(used)) {
    if (variableByName.has(name)) {
      for (const producer of entry.portsOut) {
        rawEdges.push({
          from: `box:${producer.box}`,
          fromPort: producer.port,
          to: `var:${name}`,
          toPort: null,
          label: name,
        });
      }
      for (const consumer of entry.portsIn) {
        rawEdges.push({
          from: `var:${name}`,
          fromPort: null,
          to: `box:${consumer.box}`,
          toPort: consumer.port,
          label: "",
        });
      }
    } else {
      for (const producer of entry.portsOut) {
        for (const consumer of entry.portsIn) {
          rawEdges.push({
            from: `box:${producer.box}`,
            fromPort: producer.port,
            to: `box:${consumer.box}`,
            toPort: consumer.port,
            label: name,
          });
        }
      }
    }
  }

  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();
  for (const edge of rawEdges) {
    if (!nodes.has(edge.from) || !nodes.has(edge.to)) continue;
    (incoming.get(edge.to) ?? incoming.set(edge.to, []).get(edge.to)!).push(edge.from);
    (outgoing.get(edge.from) ?? outgoing.set(edge.from, []).get(edge.from)!).push(edge.to);
  }

  const ids = [...nodes.keys()];
  const layerOf = assignLayers(ids, outgoing);
  const layers: string[][] = [];
  for (const id of ids) {
    const index = layerOf.get(id) ?? 0;
    nodes.get(id)!.layer = index;
    (layers[index] ??= []).push(id);
  }
  for (let index = 0; index < layers.length; index++) layers[index] ??= [];

  const portFraction = (id: string, port: string | null, side: "inputs" | "outputs") => {
    const list = nodes.get(id)![side];
    if (!port || list.length < 2) return 0;
    const index = list.findIndex((entry) => entry.port === port);
    return index < 0 ? 0 : (index + 1) / (list.length + 1) - 0.5;
  };

  orderLayers(
    layers,
    rawEdges
      .filter((edge) => nodes.has(edge.from) && nodes.has(edge.to))
      .map((edge) => ({
        from: edge.from,
        to: edge.to,
        toFraction: portFraction(edge.to, edge.toPort, "inputs"),
        fromFraction: portFraction(edge.from, edge.fromPort, "outputs"),
      })),
  );

  // Place: layers stack downwards, nodes sit side by side, and each layer is centred on the widest.
  const layerWidths = layers.map((layer) =>
    layer.reduce((sum, id) => sum + nodes.get(id)!.width + NODE_GAP, -NODE_GAP),
  );
  const widest = Math.max(0, ...layerWidths);

  let y = MARGIN;
  layers.forEach((layer, index) => {
    let x = MARGIN + (widest - layerWidths[index]!) / 2;
    let tallest = 0;
    for (const id of layer) {
      const node = nodes.get(id)!;
      node.x = x;
      node.y = y;
      x += node.width + NODE_GAP;
      tallest = Math.max(tallest, node.height);
    }
    y += tallest + LAYER_GAP;
  });

  const anchor = (id: string, port: string | null, side: "top" | "bottom") => {
    const node = nodes.get(id)!;
    const list = side === "top" ? node.inputs : node.outputs;
    const found = port ? list.find((entry) => entry.port === port) : undefined;
    return {
      x: node.x + (found ? found.offset : node.width / 2),
      y: side === "top" ? node.y : node.y + node.height,
    };
  };

  const edges: LayoutEdge[] = rawEdges
    .filter((edge) => nodes.has(edge.from) && nodes.has(edge.to))
    .map((edge) => {
      const from = anchor(edge.from, edge.fromPort, "bottom");
      const to = anchor(edge.to, edge.toPort, "top");
      return {
        from: { node: edge.from, port: edge.fromPort },
        to: { node: edge.to, port: edge.toPort },
        label: edge.label,
        x1: from.x,
        y1: from.y,
        x2: to.x,
        y2: to.y,
      };
    });

  const placed = [...nodes.values()];
  return {
    nodes: placed,
    edges,
    width: widest + MARGIN * 2,
    height: Math.max(MARGIN * 2, y - LAYER_GAP + MARGIN),
  };
}
