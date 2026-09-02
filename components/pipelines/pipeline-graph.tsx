import { layoutPipeline } from "@/lib/pipelines/layout";
import { renderPipelineSvg } from "@/lib/pipelines/svg";
import type { PipelineStructure } from "@/lib/pipelines/types";

/**
 * A pipeline drawn (T-014/T-016).
 *
 * A **Server Component** that emits finished SVG, which is the answer this project gives to the
 * brief's "decide early" about pipeline visualisation (DEC-107). The legacy app ships Graphviz
 * compiled to WebAssembly to every reader and lays the graph out in the browser; here the layout
 * is a pure function (`layout.ts`) and the drawing is string building (`svg.ts`), both on the
 * server, both unit-tested. Nothing is added to the client bundle and the picture is in the HTML.
 *
 * The SVG is inserted with `dangerouslySetInnerHTML`, and that is safe for a specific reason
 * rather than by habit: **it is not content, it is generated here**, from coordinates this app
 * computed, with every name escaped by `svg.ts` before it reaches the markup. No part of it is a
 * reader's input passed through. The alternative -- building a few hundred SVG elements as React
 * nodes -- would ship the same bytes with more ceremony.
 *
 * A wide graph **scrolls inside its own box** rather than squeezing: a dozen boxes laid out to fit
 * a phone are a dozen boxes nobody can read.
 */
export function PipelineGraph({
  structure,
  title,
  selected = null,
}: {
  structure: PipelineStructure;
  title: string;
  selected?: string | null;
}) {
  const layout = layoutPipeline(structure.boxes ?? [], structure.variables ?? []);
  if (layout.nodes.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-muted/20 p-3">
      <div
        className="text-foreground"
        dangerouslySetInnerHTML={{ __html: renderPipelineSvg(layout, { selected, title }) }}
      />
    </div>
  );
}
