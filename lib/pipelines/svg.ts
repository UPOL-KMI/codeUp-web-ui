import type { Layout, LayoutNode } from "./layout";

/**
 * A pipeline's graph as SVG (T-014/T-016).
 *
 * Pure string building over the coordinates `layout.ts` produced, which means the picture is
 * rendered on the server and the browser receives finished markup -- the shape D-009 and D-010
 * already chose for code highlighting and markdown, and the answer this project gives to the
 * brief's "decide early" about pipeline visualisation (DEC-107).
 *
 * **Colours are CSS custom properties, not literals.** The legacy graph is a Graphviz render with
 * `#eeffee` baked into it, which means a dark theme gets a pale green box on a dark page. Here the
 * fills come from the design system's tokens, so the diagram is themed like everything else and a
 * reader switching themes gets a diagram that switched with them.
 *
 * Every node carries a `data-name`, so a client wrapper can make selection work without parsing
 * generated markup for `<title>` elements the way the legacy click handler has to.
 */
const escape = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function nodeFill(node: LayoutNode): string {
  if (node.kind === "box")
    return "var(--pipeline-box, color-mix(in oklab, currentColor 6%, transparent))";
  if (node.kind === "reference")
    return "var(--pipeline-reference, color-mix(in oklab, currentColor 12%, transparent))";
  return "var(--pipeline-variable, transparent)";
}

function renderNode(node: LayoutNode, selected: string | null): string {
  const isSelected = selected !== null && selected === node.name;
  const stroke = isSelected ? "var(--color-primary, currentColor)" : "currentColor";
  const parts: string[] = [];

  parts.push(
    `<rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" rx="8" ` +
      `fill="${nodeFill(node)}" stroke="${stroke}" stroke-width="${isSelected ? 2 : 1}" ` +
      `stroke-opacity="${isSelected ? 1 : 0.35}" ${node.kind === "reference" ? 'stroke-dasharray="4 3"' : ""} />`,
  );

  const centre = node.x + node.width / 2;
  if (node.kind === "box") {
    parts.push(
      `<text x="${centre}" y="${node.y + 22}" text-anchor="middle" font-size="12" font-weight="600" fill="currentColor">${escape(node.name)}</text>`,
      `<text x="${centre}" y="${node.y + 38}" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.6">${escape(node.detail)}</text>`,
    );
    for (const input of node.inputs) {
      parts.push(
        `<circle cx="${node.x + input.offset}" cy="${node.y}" r="2.5" fill="currentColor" fill-opacity="0.5" />`,
        `<text x="${node.x + input.offset}" y="${node.y - 5}" text-anchor="middle" font-size="8" fill="currentColor" fill-opacity="0.55">${escape(input.port)}</text>`,
      );
    }
    for (const output of node.outputs) {
      parts.push(
        `<circle cx="${node.x + output.offset}" cy="${node.y + node.height}" r="2.5" fill="currentColor" fill-opacity="0.5" />`,
        `<text x="${node.x + output.offset}" y="${node.y + node.height + 11}" text-anchor="middle" font-size="8" fill="currentColor" fill-opacity="0.55">${escape(output.port)}</text>`,
      );
    }
  } else {
    parts.push(
      `<text x="${centre}" y="${node.y + 16}" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.6">${escape(node.name)}</text>`,
      `<text x="${centre}" y="${node.y + 29}" text-anchor="middle" font-size="11" font-family="ui-monospace, monospace" fill="currentColor">${escape(node.detail)}</text>`,
    );
  }

  return (
    `<g class="pipeline-node" data-kind="${node.kind}" data-name="${escape(node.name)}">` +
    `<title>${escape(node.name)}</title>${parts.join("")}</g>`
  );
}

export function renderPipelineSvg(
  layout: Layout,
  options: { selected?: string | null; title?: string } = {},
): string {
  const { selected = null, title = "" } = options;

  const edges = layout.edges.map((edge) => {
    // A vertical cubic: the control points sit halfway down the gap, which keeps a wire leaving a
    // port going *down* before it turns -- the thing that makes a layered diagram readable.
    const lift = Math.max(18, (edge.y2 - edge.y1) / 2);
    const path = `M ${edge.x1} ${edge.y1} C ${edge.x1} ${edge.y1 + lift}, ${edge.x2} ${edge.y2 - lift}, ${edge.x2} ${edge.y2}`;
    const label = edge.label
      ? `<text x="${(edge.x1 + edge.x2) / 2 + 4}" y="${(edge.y1 + edge.y2) / 2}" font-size="9" fill="currentColor" fill-opacity="0.55">${escape(edge.label)}</text>`
      : "";
    return (
      `<g class="pipeline-edge"><path d="${path}" fill="none" stroke="currentColor" ` +
      `stroke-opacity="0.4" stroke-width="1.2" marker-end="url(#pipeline-arrow)" />${label}</g>`
    );
  });

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Math.round(layout.width)} ${Math.round(layout.height)}" ` +
    `width="${Math.round(layout.width)}" height="${Math.round(layout.height)}" role="img" ` +
    `aria-label="${escape(title)}" class="pipeline-graph">` +
    `<defs><marker id="pipeline-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">` +
    `<path d="M 0 0 L 8 4 L 0 8 z" fill="currentColor" fill-opacity="0.4" /></marker></defs>` +
    edges.join("") +
    layout.nodes.map((node) => renderNode(node, selected)).join("") +
    `</svg>`
  );
}
