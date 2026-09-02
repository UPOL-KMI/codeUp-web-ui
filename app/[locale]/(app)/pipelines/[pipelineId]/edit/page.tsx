import type { Metadata } from "next";
import { forbidden } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { getBoxTypes, getPipeline, getPipelineExercises } from "@/lib/api/pipelines";
import { getRuntimeEnvironments } from "@/lib/api/runtime-environments";
import { resolveBreadcrumbs } from "@/lib/breadcrumbs/manifest";

import { Link } from "@/i18n/navigation";
import { PageShell } from "@/components/page-shell";
import { PipelineSettings } from "@/components/pipelines/pipeline-settings";
import { StructureEditor } from "@/components/pipelines/structure-editor";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "PipelineEdit" });
  return { title: t("title") };
}

/**
 * Editing a pipeline (T-015) and its structure (T-016) -- the legacy `EditPipeline` and
 * `EditPipelineStructure` routes, which are one screen here because they are one save: core-api's
 * `updatePipeline` replaces the whole entity, and splitting them across two pages would mean each
 * carrying the other's state through a round trip to avoid wiping it.
 *
 * **The exercises using this pipeline are named at the top, not the bottom.** A pipeline is shared
 * machinery: changing one changes the evaluation of every exercise configured against it, and that
 * is the fact an editor needs before touching anything rather than after. Forking is offered for
 * exactly that reason.
 *
 * The structure editor draws the graph **as it is being edited**, using the same pure layout and
 * SVG functions the read-only screen renders on the server (DEC-107). That is what makes a wiring
 * mistake visible before it is saved -- and a wiring mistake in a pipeline does not fail loudly:
 * boxes are connected by *name matching*, so a wrong name is a wire that quietly is not there.
 */
export default async function EditPipelinePage({
  params,
}: {
  params: Promise<{ pipelineId: string }>;
}) {
  const [{ pipelineId }, locale] = await Promise.all([params, getLocale()]);
  const [t, pipeline] = await Promise.all([
    getTranslations("PipelineEdit"),
    getPipeline(pipelineId),
  ]);

  // Reading a pipeline is something any teacher may do; changing one is not.
  if (pipeline.can.update !== true && pipeline.can.fork !== true) forbidden();

  const [boxTypes, environments, exercises, breadcrumbs] = await Promise.all([
    getBoxTypes(),
    getRuntimeEnvironments(),
    getPipelineExercises(pipelineId, locale),
    resolveBreadcrumbs(`/pipelines/${pipelineId}/edit`, locale),
  ]);

  return (
    <PageShell
      title={t("title")}
      subtitle={pipeline.name}
      breadcrumbs={breadcrumbs}
      actions={
        <Link
          href={`/pipelines/${pipelineId}`}
          className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {t("backToPipeline")}
        </Link>
      }
    >
      <div className="flex flex-col gap-10">
        {exercises.length > 0 && (
          <p className="rounded-lg border border-warning bg-warning/10 p-4 text-sm">
            {t("inUse", { count: exercises.length })}
          </p>
        )}

        <section aria-labelledby="pipeline-settings" className="flex flex-col gap-3">
          <h2 id="pipeline-settings" className="text-base font-semibold tracking-tight">
            {t("settings.title")}
          </h2>
          <PipelineSettings
            pipelineId={pipelineId}
            version={pipeline.version}
            name={pipeline.name}
            description={pipeline.description}
            parameters={pipeline.parameters}
            environments={environments}
            selectedEnvironments={pipeline.runtimeEnvironmentIds}
            can={pipeline.can}
          />
        </section>

        <section aria-labelledby="pipeline-structure" className="flex flex-col gap-3">
          <div>
            <h2 id="pipeline-structure" className="text-base font-semibold tracking-tight">
              {t("structure.title")}
            </h2>
            <p className="text-sm text-muted-foreground">{t("structure.explain")}</p>
          </div>
          {/* Keyed by version so that any save -- this form's or the settings form's, both of
              which bump it -- re-seeds the editor from what core-api now holds. Without it the
              structure editor would keep showing state from before somebody else's save, and the
              optimistic lock would then refuse the next one for reasons nothing on screen explains. */}
          <StructureEditor
            key={pipeline.version}
            pipelineId={pipelineId}
            version={pipeline.version}
            structure={pipeline.pipeline}
            boxTypes={boxTypes}
            readOnly={pipeline.can.update !== true}
          />
        </section>
      </div>
    </PageShell>
  );
}
