import { z } from "zod";

/**
 * An assignment's own localized texts, as the form collects them and the Server Action
 * re-validates them (G-007). Its own module apart from the `"use server"` file, per D-004's rule,
 * and apart from `assignment.schema.ts` because core-api keeps the two saves apart: the texts have
 * their own endpoint, their own version check and their own rules.
 *
 * The rules restated here are core-api's own
 * (`AssignmentsPresenter::actionUpdateLocalizedTexts`) plus the legacy form's two: a locale may
 * appear only once, an external link must be a real URL, a language that is offered needs a name,
 * and it needs either a text or a link -- an assignment whose text is blank and whose link is
 * blank says nothing to the student who opens it.
 *
 * **A blank name removes that language.** core-api replaces the whole collection with what it is
 * sent, so the way to delete a translation is to omit it, and the way a form expresses that is an
 * empty field. One has to survive, or the assignment becomes unnameable.
 */
export const assignmentTextSchema = z.object({
  locale: z.string().min(2),
  name: z.string(),
  /** Markdown, as the student reads it, with `%%key%%` file placeholders unresolved. */
  text: z.string(),
  /** An address holding the full text, where it is kept outside ReCodEx. */
  link: z.string(),
});

export const assignmentTextsSchema = z
  .object({ texts: z.array(assignmentTextSchema).min(1) })
  .superRefine((values, ctx) => {
    if (!values.texts.some((text) => text.name.trim() !== "")) {
      ctx.addIssue({ code: "custom", path: ["texts"], message: "nameRequired" });
    }

    values.texts.forEach((text, index) => {
      // A language nobody filled in is not an error -- it is the absence of that translation.
      if (text.name.trim() === "") return;

      if (text.text.trim() === "" && text.link.trim() === "") {
        ctx.addIssue({ code: "custom", path: ["texts", index, "text"], message: "textOrLink" });
      }
      // core-api answers 400 for a link that is not a URL, which is a worse way to learn it.
      if (text.link.trim() !== "" && !isUrl(text.link.trim())) {
        ctx.addIssue({ code: "custom", path: ["texts", index, "link"], message: "invalidLink" });
      }
    });
  });

/** core-api's `Validators::isUrl` in the shape a browser already has. */
function isUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export type AssignmentTextsValues = z.infer<typeof assignmentTextsSchema>;
