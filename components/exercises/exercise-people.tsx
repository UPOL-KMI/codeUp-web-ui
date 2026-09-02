"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import {
  forkExercise,
  searchPeople,
  setExerciseAdmins,
  setExerciseAuthor,
  type PersonHit,
} from "@/lib/actions/exercise-people";
import type { ExerciseDetail } from "@/lib/api/exercise-detail";
import type { ActionResult } from "@/lib/forms/action-result";

import { useRouter } from "@/i18n/navigation";
import { ConfirmDialog } from "@/components/dialog/confirm-dialog";
import { useToast } from "@/components/toast/toast-provider";

/**
 * Who else may change this exercise, whose it is, and copying it elsewhere (T-023).
 *
 * **Three permissions, three controls, because core-api grants them separately.**
 * `updateAdmins` adds colleagues who may edit; `changeAuthor` hands the exercise over, and a group
 * admin often has the first without the second; `fork` only needs to be allowed to *read* this
 * exercise -- and to create one in the destination group, which is the group's own rule and has no
 * hint on the exercise (DEC-090's shape again, so the offer is built from the groups the reader
 * teaches and core-api decides for real).
 *
 * **Handing the exercise over confirms, and says what it costs**: the outgoing author keeps
 * whatever their group role gives them and nothing more, so somebody who was only its author stops
 * being able to edit it the moment they save. That is not reversible from this screen -- the new
 * author would have to hand it back.
 *
 * People are found by searching, not chosen from a list: an instance has as many users as it has,
 * and core-api restricts who may search them. A reader who may not gets no candidates, which is
 * the honest rendering of a permission they do not hold rather than a control that errors.
 *
 * **Who may be an administrator is core-api's rule and is not pre-filtered here.** It refuses a
 * plain student ("Given user is not allowed to be administrator of an exercise"), and that message
 * is shown as it came. Guessing the rule in this app -- by role name, say -- is precisely what
 * AGENTS.md constraint 4 forbids; the offer is everybody the reader may find, and core-api decides.
 */
export function ExercisePeople({
  exercise,
  teachingGroups,
  canFork,
}: {
  exercise: ExerciseDetail;
  teachingGroups: { id: string; name: string }[];
  canFork: boolean;
}) {
  const t = useTranslations("ExerciseEdit.people");
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [isSearching, startSearch] = useTransition();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<PersonHit[]>([]);
  const [searched, setSearched] = useState(false);
  const [handingOver, setHandingOver] = useState<PersonHit | null>(null);
  const [group, setGroup] = useState("");

  const canUpdateAdmins = exercise.can.updateAdmins === true;
  const canChangeAuthor = exercise.can.changeAuthor === true;

  async function run(call: () => Promise<ActionResult<unknown>>, successKey: string) {
    setPending(true);
    const result = await call();
    setPending(false);
    if (!result.success) {
      toast.error(result.formError ?? t("errors.generic"));
      return null;
    }
    toast.success(t(successKey));
    router.refresh();
    return result.data;
  }

  function search() {
    startSearch(() => {
      void searchPeople(query).then((result) => {
        setSearched(true);
        setHits(result.success ? result.data : []);
        if (!result.success) toast.error(result.formError ?? t("errors.searchFailed"));
      });
    });
  }

  const adminIds = exercise.admins.map((admin) => admin.id);
  const input =
    "rounded-md border border-input bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">{t("author")}</h3>
        <p className="text-sm">{exercise.author.name || t("unknownPerson")}</p>
        {!canChangeAuthor && <p className="text-xs text-muted-foreground">{t("cannotHandOver")}</p>}
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">{t("admins")}</h3>
        <p className="text-sm text-muted-foreground">{t("adminsExplain")}</p>
        {exercise.admins.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noAdmins")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {exercise.admins.map((admin) => (
              <li key={admin.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="text-sm">{admin.name || admin.id}</span>
                {canUpdateAdmins && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      void run(
                        () =>
                          setExerciseAdmins(
                            exercise.id,
                            adminIds.filter((id) => id !== admin.id),
                          ),
                        "adminRemoved",
                      )
                    }
                    className="rounded-md border border-input px-2 py-1 text-xs hover:bg-muted disabled:opacity-60"
                  >
                    {t("removeAdmin")}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {(canUpdateAdmins || canChangeAuthor) && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">{t("findPeople")}</h3>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-sm">
              {t("search")}
              <input
                type="search"
                className={`${input} w-64`}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    search();
                  }
                }}
              />
            </label>
            <button
              type="button"
              disabled={isSearching || query.trim().length < 2}
              onClick={search}
              className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-60"
            >
              {isSearching ? t("searching") : t("searchButton")}
            </button>
          </div>

          {searched && hits.length === 0 && (
            <p className="text-sm text-muted-foreground">{t("noPeople")}</p>
          )}
          {hits.length > 0 && (
            <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
              {hits.map((person) => (
                <li key={person.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="text-sm">{person.name}</span>
                  <span className="flex gap-2">
                    {canUpdateAdmins && !adminIds.includes(person.id) && (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() =>
                          void run(
                            () => setExerciseAdmins(exercise.id, [...adminIds, person.id]),
                            "adminAdded",
                          )
                        }
                        className="rounded-md border border-input px-2 py-1 text-xs hover:bg-muted disabled:opacity-60"
                      >
                        {t("addAdmin")}
                      </button>
                    )}
                    {canChangeAuthor && person.id !== exercise.author.id && (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => setHandingOver(person)}
                        className="rounded-md border border-input px-2 py-1 text-xs hover:bg-muted disabled:opacity-60"
                      >
                        {t("makeAuthor")}
                      </button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {canFork && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">{t("fork")}</h3>
          <p className="text-sm text-muted-foreground">{t("forkExplain")}</p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-sm">
              {t("forkInto")}
              <select
                className={input}
                aria-label={t("forkInto")}
                value={group}
                onChange={(event) => setGroup(event.target.value)}
              >
                <option value="">{t("chooseGroup")}</option>
                {teachingGroups.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={pending || !group}
              onClick={() => {
                void run(() => forkExercise(exercise.id, group), "forked").then((data) => {
                  const forked = data as { id: string } | null;
                  if (forked) router.push(`/exercises/${forked.id}/edit`);
                });
              }}
              className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {t("forkButton")}
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={handingOver !== null}
        onOpenChange={(open) => {
          if (!open) setHandingOver(null);
        }}
        title={t("confirmAuthor.title")}
        description={t("confirmAuthor.description", { name: handingOver?.name ?? "" })}
        confirmLabel={t("confirmAuthor.confirm")}
        pending={pending}
        onConfirm={() => {
          const person = handingOver;
          setHandingOver(null);
          if (person) void run(() => setExerciseAuthor(exercise.id, person.id), "authorChanged");
        }}
      />
    </div>
  );
}
