import { getLocale, getTranslations } from "next-intl/server";

import { getCurrentUser, type CurrentUser } from "@/lib/api/current-user";
import {
  getGroupAssignments,
  getGroupDetail,
  getGroupPointsMatrix,
  getGroupStudents,
  getRelocationTargets,
  type AssignmentFilter,
  type GroupDetail,
} from "@/lib/api/group-detail";
import { getExamLocks, getExamRoster } from "@/lib/api/group-exams";
import { getGroupInvitations } from "@/lib/api/group-invitation";
import { getGroupShadowAssignments } from "@/lib/api/shadow-assignment";
import { resolveBreadcrumbs } from "@/lib/breadcrumbs/manifest";
import { requestOrigin } from "@/lib/http/absolute-url";
import { currentPhase } from "@/lib/status/exam";

import { routing } from "@/i18n/routing";

import { Link } from "@/i18n/navigation";
import { AssignmentFilterNav } from "@/components/groups/assignment-filter";
import { AssignmentTable } from "@/components/groups/assignment-table";
import { ExamLocks } from "@/components/groups/exam-locks";
import { ExamRoster } from "@/components/groups/exam-roster";
import { ExamStatus } from "@/components/groups/exam-status";
import { ExamTable } from "@/components/groups/exam-table";
import { GroupInfo } from "@/components/groups/group-info";
import { GroupTabs, type GroupTab } from "@/components/groups/group-tabs";
import { InvitationManager } from "@/components/groups/invitation-manager";
import { MemberManager } from "@/components/groups/member-manager";
import { MembershipButton } from "@/components/groups/membership-button";
import { PointsMatrixTable } from "@/components/groups/points-matrix";
import { GroupSettingsControls } from "@/components/groups/settings-controls";
import { GroupSettingsForm } from "@/components/groups/settings-form";
import { StudentTable } from "@/components/groups/student-table";
import { PageShell } from "@/components/page-shell";
import { EmptyState } from "@/components/state/empty-state";
import { Badge } from "@/components/status/badge";

/**
 * A group (S-005, S-006, S-007), tabbed per `docs/IA.md` §4.2 with the tab in `searchParams` so a
 * particular tab is a shareable URL and the back button works.
 *
 * Which tabs exist is core-api's answer, not a role check here (brief §3.4): `permissionHints`
 * decides whether the reader may see assignments or students at all. Tabs whose screens are not
 * built yet (Exams, Settings -- S-008, S-009) are simply absent rather than leading to a stub.
 *
 * An unknown `?tab=` falls back to Info rather than 404ing: the tab is a view of a resource that
 * does exist, and a stale link from an older version of this app should still show the group. The
 * same goes for an unknown `?filter=`.
 */
const FILTERS: AssignmentFilter[] = ["all", "open", "closed", "submitted"];

export default async function GroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string }>;
  searchParams: Promise<{ tab?: string; filter?: string; exam?: string }>;
}) {
  const [{ groupId }, query, locale] = await Promise.all([params, searchParams, getLocale()]);
  const [t, group, viewer] = await Promise.all([
    getTranslations("Group"),
    getGroupDetail(groupId, locale),
    getCurrentUser(),
  ]);
  const breadcrumbs = await resolveBreadcrumbs(`/groups/${groupId}`, locale);
  const membership = ownMembershipAction(group, viewer);

  const tabs: GroupTab[] = [
    { id: "info", label: t("tabs.info") },
    ...(group.can.viewAssignments && !group.organizational
      ? [{ id: "assignments", label: t("tabs.assignments") }]
      : []),
    ...(group.can.viewStudents ? [{ id: "students", label: t("tabs.students") }] : []),
    ...(showExamsTab(group) ? [{ id: "exams", label: t("tabs.exams") }] : []),
    ...(showSettingsTab(group) ? [{ id: "settings", label: t("tabs.settings") }] : []),
  ];
  const current = tabs.some((candidate) => candidate.id === query.tab) ? query.tab! : "info";

  return (
    <PageShell
      title={group.name}
      subtitle={
        group.path.length > 0 ? group.path.map((parent) => parent.name).join(" / ") : undefined
      }
      breadcrumbs={breadcrumbs}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {group.archived && <Badge tone="warning">{t("badges.archived")}</Badge>}
          {group.exam && <Badge tone="warning">{t("badges.exam")}</Badge>}
          {group.public && <Badge tone="info">{t("badges.public")}</Badge>}
          {membership && <MembershipButton groupId={groupId} action={membership} />}
        </div>
      }
      tabs={<GroupTabs groupId={groupId} tabs={tabs} current={current} />}
    >
      {current === "assignments" && <AssignmentsTab groupId={groupId} filter={query.filter} />}
      {current === "students" && <StudentsTab groupId={groupId} />}
      {current === "exams" && <ExamsTab group={group} selectedExam={query.exam ?? null} />}
      {current === "settings" && <SettingsTab group={group} />}
      {current === "info" && <GroupInfo group={group} />}
    </PageShell>
  );
}

/**
 * Whether this reader can put themselves into this group, or take themselves out (S-026).
 *
 * **The one place in this app that reads an ACL's conditions instead of a permission hint, because
 * there is no hint to read (DEC-090).** `addStudent` and `removeStudent` are absent from a group's
 * `permissionHints` entirely -- confirmed live, the keys are missing rather than `false` -- because
 * both rules are written against a *student* subject (`student.isSameUser`,
 * `student.isNotGroupLocked`) and a hint computed for the group alone has nobody to put there. The
 * conditions are all fields this page already holds, so they are restated here and core-api decides
 * for real on the call: joining a group that is not public answers 403, verified live.
 *
 * The shape is the legacy screen's own (`GroupInfo`: `!isAdmin && !isSupervisor && !organizational
 * && !archived && (public || (isStudent && !detaining))`), with two conditions core-api's ACL adds
 * and the legacy check leaves to the API: an exam group detains by definition (`removeStudent`'s
 * `group.isNotExam`), and a reader locked into an exam elsewhere may join nothing (`addStudent`'s
 * `student.isNotGroupLocked`).
 *
 * `myStats` is what "I study here" means -- it exists only for groups core-api computes the
 * reader's own stats for.
 */
function ownMembershipAction(group: GroupDetail, viewer: CurrentUser): "join" | "leave" | null {
  // Staff of this group are not offered a student's membership in it. core-api would allow it, and
  // the legacy screen hides it for exactly these two roles -- for the administrator of a course,
  // "join" is a misclick rather than an intention.
  const isStaff = group.members.some(
    (member) =>
      member.id === viewer.id && (member.role === "admin" || member.role === "supervisor"),
  );
  if (isStaff || group.organizational || group.archived) return null;

  if (group.myStats !== null) {
    // A group that detains its students, or is running as an exam, does not let them walk out.
    if (group.detaining || group.exam) return null;
    if (viewer.groupLock === group.id) return null;
    return "leave";
  }

  if (!group.public) return null;
  // Locked into an exam somewhere: core-api refuses every other group until it ends.
  if (viewer.groupLock !== null) return null;
  return "join";
}

/**
 * The legacy app's own rule for offering its Edit screen (`GroupNavigation`'s `canEdit`): any one
 * of the four things this tab can do. Membership changes ride along on `update`, which is what
 * core-api requires for them anyway.
 */
function showSettingsTab(group: GroupDetail): boolean {
  return (
    group.can.update === true ||
    group.can.archive === true ||
    group.can.remove === true ||
    group.can.relocate === true ||
    // T-018 put the invitation links here, and `editInvitations` is granted separately from
    // `update` in core-api's own ACL -- so a reader who may only mint links still needs the tab.
    group.can.editInvitations === true
  );
}

/**
 * Administering the group (S-009): its settings, what kind of group it is, where it sits, who
 * belongs to it, and its removal.
 *
 * An **archived group is immutable**, which is why the form is not rendered for one at all rather
 * than rendered and refused on submit -- the same reason the legacy screen hides it. Unarchiving
 * is still offered, and is the way back.
 */
async function SettingsTab({ group }: { group: GroupDetail }) {
  // Two namespaces: this tab's own copy, and T-018's invitation section, which is its own
  // namespace because the client component that owns the section reads it directly.
  const [t, tInvitations, locale] = await Promise.all([
    getTranslations("Group.settings"),
    getTranslations("Group.invitations"),
    getLocale(),
  ]);
  const canEditMembers = group.can.update === true && !group.archived;
  const [relocationTargets, students, invitations, origin] = await Promise.all([
    group.can.relocate === true && !group.archived
      ? getRelocationTargets(group.id, locale)
      : Promise.resolve([]),
    group.can.viewStudents === true && !group.organizational
      ? getGroupStudents(group.id)
      : Promise.resolve([]),
    group.can.viewInvitations === true && !group.organizational
      ? getGroupInvitations(group.id)
      : Promise.resolve([]),
    requestOrigin(),
  ]);

  return (
    <div className="flex flex-col gap-8">
      {group.can.update === true && !group.archived && (
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-medium">{t("form.title")}</h3>
          <GroupSettingsForm group={group} locales={routing.locales} />
        </section>
      )}

      <GroupSettingsControls group={group} relocationTargets={relocationTargets} />

      {group.can.viewInvitations === true && !group.organizational && (
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-medium">{tInvitations("title")}</h3>
          <InvitationManager
            groupId={group.id}
            invitations={invitations}
            origin={origin}
            canEdit={group.can.editInvitations === true && !group.archived}
          />
        </section>
      )}

      {group.can.viewStudents === true && (
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-medium">{t("members.title")}</h3>
          <MemberManager
            groupId={group.id}
            members={group.members}
            students={students.map((student) => ({ id: student.id, fullName: student.fullName }))}
            canEditMembers={canEditMembers}
            canEditStudents={canEditMembers && !group.organizational}
          />
        </section>
      )}
    </div>
  );
}

/**
 * The legacy app's own rule for offering the Exams screen (`GroupNavigation`): whoever may set an
 * exam period, plus anyone in a group that has held one or has one coming -- a student needs the
 * tab to lock themselves in, and needs it only then.
 */
function showExamsTab(group: GroupDetail): boolean {
  return (
    group.can.setExamPeriod === true ||
    group.can.removeExamPeriod === true ||
    group.exams.length > 0 ||
    group.examTerm !== null
  );
}

/**
 * The group's exams (S-008). The phase is decided here, once, from the server's clock: it chooses
 * what this tab fetches -- the roster only matters while an exam runs, the lock records only for
 * one that has ended. `ExamStatus` keeps ticking in the browser and refreshes the route when its
 * own answer stops matching `serverPhase`, so a page left open at the moment an exam begins
 * becomes the exam page rather than staying the page before it.
 */
async function ExamsTab({
  group,
  selectedExam,
}: {
  group: GroupDetail;
  selectedExam: string | null;
}) {
  const t = await getTranslations("Group.exams");
  const viewer = await getCurrentUser();
  const phase = currentPhase(group.examTerm?.begin ?? null, group.examTerm?.end ?? null);

  const canWatchRoster = group.can.viewStudents === true && group.can.setExamPeriod === true;
  const [roster, locks] = await Promise.all([
    phase === "running" && canWatchRoster
      ? getExamRoster(group.studentIds, group.id)
      : Promise.resolve([]),
    selectedExam && group.can.viewExamLocks === true
      ? getExamLocks(group.id, selectedExam)
      : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <ExamStatus
        groupId={group.id}
        begin={group.examTerm?.begin ?? null}
        end={group.examTerm?.end ?? null}
        lockType={group.examTerm?.lockType ?? null}
        serverPhase={phase}
        canSetPeriod={group.can.setExamPeriod === true}
        canRemovePeriod={group.can.removeExamPeriod === true}
        viewerId={viewer.id}
        studiesHere={group.myStats !== null}
        lockedHere={viewer.groupLock === group.id}
        ipLock={viewer.ipLock}
      />

      {phase === "running" && canWatchRoster && <ExamRoster groupId={group.id} students={roster} />}

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">{t("table.title")}</h3>
        <ExamTable
          exams={group.exams}
          groupId={group.id}
          selected={phase === "running" ? null : selectedExam}
          selectable={phase !== "running" && group.can.viewExamLocks === true}
        />
      </section>

      {selectedExam && phase !== "running" && group.can.viewExamLocks === true && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">{t("locks.title")}</h3>
          <ExamLocks locks={locks} />
        </section>
      )}
    </div>
  );
}

async function AssignmentsTab({ groupId, filter }: { groupId: string; filter?: string }) {
  const locale = await getLocale();
  const [t, group] = await Promise.all([
    getTranslations("Group.assignments"),
    getGroupDetail(groupId, locale),
  ]);

  const options = group.myStats ? FILTERS : FILTERS.filter((option) => option !== "submitted");
  const current = (options.find((option) => option === filter) ?? "all") as AssignmentFilter;
  // Shadow assignments are the group's other kind of work (S-020) -- nothing is submitted for
  // them and nothing is evaluated, so they are a list of their own rather than rows mixed into a
  // table whose columns are all about submissions. The legacy group screen shows both here too,
  // and the filter above deliberately does not apply to them: none of its four states can.
  const [assignments, shadowAssignments] = await Promise.all([
    getGroupAssignments(groupId, locale, current),
    getGroupShadowAssignments(groupId, locale),
  ]);

  return (
    <div className="flex flex-col gap-4">
      {group.can.assignExercise === true && !group.archived && (
        <div>
          <Link
            href={`/groups/${groupId}/assign`}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {t("assignExercise")}
          </Link>
        </div>
      )}
      <AssignmentFilterNav
        groupId={groupId}
        current={current}
        options={options}
        labels={{
          all: t("filters.all"),
          open: t("filters.open"),
          closed: t("filters.closed"),
          submitted: t("filters.submitted"),
        }}
      />
      {assignments.length === 0 ? (
        <EmptyState title={t(`empty.${current}`)} />
      ) : (
        <AssignmentTable assignments={assignments} groupId={groupId} />
      )}

      {shadowAssignments.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">{t("shadow.title")}</h3>
          <p className="text-xs text-muted-foreground">{t("shadow.explain")}</p>
          <ul className="flex flex-col gap-2">
            {shadowAssignments.map((shadow) => (
              <li
                key={shadow.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm"
              >
                <Link
                  href={`/shadow-assignments/${shadow.id}`}
                  className="font-medium hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {shadow.name || t("shadow.untitled")}
                </Link>
                <span className="flex flex-wrap items-center gap-2">
                  {shadow.isBonus && <Badge tone="info">{t("shadow.bonus")}</Badge>}
                  {!shadow.isPublic && <Badge tone="warning">{t("shadow.hidden")}</Badge>}
                  <span className="tabular-nums text-muted-foreground">
                    {shadow.myPoints !== null
                      ? t("shadow.myPoints", { points: shadow.myPoints, max: shadow.maxPoints })
                      : t("shadow.maxPoints", { max: shadow.maxPoints })}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

async function StudentsTab({ groupId }: { groupId: string }) {
  const locale = await getLocale();
  const [t, tPoints, students, matrix] = await Promise.all([
    getTranslations("Group.students"),
    getTranslations("Group.points"),
    getGroupStudents(groupId),
    getGroupPointsMatrix(groupId, locale),
  ]);

  if (students.length === 0) {
    return <EmptyState title={t("empty.title")} description={t("empty.description")} />;
  }

  return (
    <div className="flex flex-col gap-8">
      <StudentTable students={students} groupId={groupId} />

      {/* T-006. Both tables come out of the same `/students/stats` response, so the matrix costs
          one call for the assignment names and nothing for the data. */}
      {matrix.columns.length > 0 && (
        <section aria-labelledby="group-points" className="flex flex-col gap-2">
          <h3 id="group-points" className="text-sm font-medium">
            {tPoints("title")}
          </h3>
          <p className="text-xs text-muted-foreground">{tPoints("explain")}</p>
          <PointsMatrixTable matrix={matrix} />
        </section>
      )}
    </div>
  );
}
