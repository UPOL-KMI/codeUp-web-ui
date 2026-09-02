import "server-only";

import { apiPost } from "./client";
import { apiRead } from "./read";

/**
 * The instances this deployment runs (AD-004/AD-005), and the licences that keep them working
 * (AD-008).
 *
 * **An instance is mostly a root group wearing a hat.** Its name and description are the group's,
 * which is why `POST /v1/instances/{id}` accepts exactly one field -- `isOpen` -- and why the
 * legacy "edit instance" screen is a single checkbox. Renaming one means editing its root group,
 * which is S-009's screen and reachable from here rather than reimplemented.
 *
 * **Reading the list is public.** `permissions.neon` grants `instance.viewAll` and `viewDetail` to
 * the `unauthenticated` role -- that is how the registration form offers a choice of instance
 * before anybody has signed in (A-003 fetches it without a token). Everything that *changes* an
 * instance is the superadmin's, and `viewLicences` sits in between: superadmin, on an instance
 * they belong to. All three verified live.
 *
 * An instance carries no `permissionHints` either (checked, like every entity but a group), so
 * what is offered follows DEC-110's shape: the reader's role decides the controls, core-api decides
 * the outcome.
 */
export interface Instance {
  id: string;
  name: string;
  description: string;
  /** The person core-api names as this instance's administrator. */
  adminId: string | null;
  /** Whether people may register into it themselves. */
  isOpen: boolean;
  /** core-api's own verdict over the licences below, not a count of them. */
  hasValidLicence: boolean;
  createdAt: number;
  /** The group every other group in the instance descends from. */
  rootGroupId: string | null;
}

interface InstancePayload {
  id: string;
  name?: string;
  description?: string;
  adminId?: string | null;
  isOpen?: boolean;
  hasValidLicence?: boolean;
  createdAt?: number;
  rootGroupId?: string | null;
}

function instance(payload: InstancePayload): Instance {
  return {
    id: payload.id,
    name: payload.name ?? "",
    description: payload.description ?? "",
    adminId: payload.adminId ?? null,
    isOpen: payload.isOpen === true,
    hasValidLicence: payload.hasValidLicence === true,
    createdAt: payload.createdAt ?? 0,
    rootGroupId: payload.rootGroupId ?? null,
  };
}

export interface InstanceList {
  instances: Instance[];
  /** The administrators named above, by id -- one batched lookup rather than one call per row. */
  admins: Map<string, string>;
}

/**
 * Every instance, with the people who administer them.
 *
 * A bare array, not a paginated envelope -- a deployment has a handful of these, and core-api does
 * not paginate them. So this list *is* fetched whole (Q-015's trade the usual way round), and the
 * screen sorts it by name in the reader's own locale rather than asking core-api to.
 */
export async function getInstances(locale: string): Promise<InstanceList> {
  const payload = await apiRead<InstancePayload[]>("/v1/instances");
  const instances = payload
    .map(instance)
    .sort((a, b) => a.name.localeCompare(b.name, locale || undefined));

  const adminIds = [...new Set(instances.map((one) => one.adminId).filter(Boolean))] as string[];
  const people =
    adminIds.length > 0
      ? await apiPost<{ id: string; fullName: string }[]>("/v1/users/list", { ids: adminIds })
      : [];

  return { instances, admins: new Map(people.map((person) => [person.id, person.fullName])) };
}

export async function getInstance(instanceId: string): Promise<Instance> {
  return instance(
    await apiRead<InstancePayload>("/v1/instances/{id}", { pathParams: { id: instanceId } }),
  );
}

/**
 * A licence is a note with an expiry and a revocation switch (AD-008).
 *
 * `hasValidLicence` on the instance is core-api's verdict over the whole set, not something this
 * app derives -- a licence counts only while it is both unrevoked and unexpired, and the screen
 * shows each row's own state so a "no valid licence" instance says which of the two happened.
 */
export interface Licence {
  id: string;
  note: string;
  validUntil: number;
  /** False once an administrator has revoked it, regardless of the date. */
  isValid: boolean;
}

export async function getInstanceLicences(instanceId: string): Promise<Licence[]> {
  const payload = await apiRead<
    { id: string; note?: string; validUntil?: number; isValid?: boolean }[]
  >("/v1/instances/{id}/licences", { pathParams: { id: instanceId } });

  return payload
    .map((licence) => ({
      id: licence.id,
      note: licence.note ?? "",
      validUntil: licence.validUntil ?? 0,
      isValid: licence.isValid === true,
    }))
    .sort((a, b) => b.validUntil - a.validUntil);
}
