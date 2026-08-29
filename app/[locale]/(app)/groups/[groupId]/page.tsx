import { getLocale, getTranslations } from "next-intl/server";

import { getCurrentUser } from "@/lib/api/current-user";
import {
  getGroupAssignments,
  getGroupDetail,
  getGroupStudents,
  getRelocationTargets,
  type AssignmentFilter,
  type GroupDetail,
} from "@/lib/api/group-detail";
import { getExamLocks, getExamRoster } from "@/lib/api/group-exams";
import { getGroupShadowAssignments } from "@/lib/api/shadow-assignment";
import { resolveBreadcrumbs } from "@/lib/breadcrumbs/manifest";
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
import { MemberManager } from "@/components/groups/member-manager";
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
  const [t, group] = await Promise.all([getTranslations("Group"), getGroupDetail(groupId, locale)]);
  const breadcrumbs = await resolveBreadcrumbs(`/groups/${groupId}`, locale);

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
        <div className="flex flex-wrap gap-1">
          {group.archived && <Badge tone="warning">{t("badges.archived")}</Badge>}
          {group.exam && <Badge tone="warning">{t("badges.exam")}</Badge>}
          {group.public && <Badge tone="info">{t("badges.public")}</Badge>}
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
 * The legacy app's own rule for offering its Edit screen (`GroupNavigation`'s `canEdit`): any one
 * of the four things this tab can do. Membership changes ride along on `update`, which is what
 * core-api requires for them anyway.
 */
function showSettingsTab(group: GroupDetail): boolean {
  return (
    group.can.update === true ||
    group.can.archive === true ||
    group.can.remove === true ||
    group.can.relocate === true
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
  const [t, locale] = await Promise.all([getTranslations("Group.settings"), getLocale()]);
  const canEditMembers = group.can.update === true && !group.archived;
  const [relocationTargets, students] = await Promise.all([
    group.can.relocate === true && !group.archived
      ? getRelocationTargets(group.id, locale)
      : Promise.resolve([]),
    group.can.viewStudents === true && !group.organizational
      ? getGroupStudents(group.id)
      : Promise.resolve([]),
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
  const [t, students] = await Promise.all([
    getTranslations("Group.students"),
    getGroupStudents(groupId),
  ]);

  return students.length === 0 ? (
    <EmptyState title={t("empty.title")} description={t("empty.description")} />
  ) : (
    <StudentTable students={students} groupId={groupId} />
  );
}
