import "server-only";

import { requireSession } from "@/lib/auth/require-session";

import type { paths } from "./core-api.generated";

export type ApiPath = keyof paths;

type QueryValue = string | number | boolean | undefined;

interface RequestOptions {
  pathParams?: Record<string, string>;
  query?: Record<string, QueryValue>;
  body?: unknown;
}

interface CoreApiErrorBody {
  message: string;
  code: string;
  parameters: Record<string, unknown> | null;
}

interface CoreApiEnvelope<T> {
  success: boolean;
  error?: CoreApiErrorBody;
  payload?: T;
}

/**
 * Normalised core-api error. `code` is the short, stable string from
 * `FrontendErrorMappings` (e.g. `"403-002"`), read directly from
 * `repos/api/app/exceptions/FrontendErrorMappings.php` and confirmed against the legacy app's
 * own `apiErrorMessages.js`, which keys a localised message table on exactly this string --
 * that's the intended consumer for `code`/`parameters` here, once a later ticket builds the
 * equivalent next-intl-backed table. `message` is core-api's own English text, a reasonable
 * fallback for any `code` not yet in that table. Not a subclass of a generic `Error` thrown by
 * `fetch()` itself -- this only wraps core-api's own `{success: false, error: {...}}` responses
 * or a non-JSON response, both confirmed shapes, not network failures.
 */
export class ApiError extends Error {
  readonly httpStatus: number;
  readonly code: string;
  readonly parameters: Record<string, unknown> | null;

  constructor(
    httpStatus: number,
    code: string,
    message: string,
    parameters: Record<string, unknown> | null,
  ) {
    super(message);
    this.name = "ApiError";
    this.httpStatus = httpStatus;
    this.code = code;
    this.parameters = parameters;
  }
}

function substitutePathParams(path: string, pathParams?: Record<string, string>): string {
  return path.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = pathParams?.[key];
    if (value === undefined) {
      throw new Error(`API path '${path}' requires path param '${key}', none was given.`);
    }
    return encodeURIComponent(value);
  });
}

function buildQueryString(query?: Record<string, QueryValue>): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value));
  }
  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

/**
 * The one `server-only` gateway to core-api for authenticated Server Component / Server Action /
 * Route Handler code (brief §5: "Server-side reads: Server Components call a `server-only` API
 * client that pulls the token from `cookies()`"). Calls `requireSession()` itself on every request
 * -- not the caller (DEC-022/037's boundary, restated once more here since this is the function
 * that principle was written for) -- so every call site gets the redirect-on-no-session behaviour
 * for free and can't accidentally skip it.
 *
 * `path` is typed against `keyof paths` from the generated `core-api.generated.ts`
 * (`pnpm generate:api-types`, vendored spec at `openapi/core-api.yaml`) -- a real compile-time
 * guarantee that the endpoint exists and is spelled correctly, catching typos this same way a
 * broken string literal never could. Request bodies and query/path params are *not* inferred
 * per-endpoint from that same generated file, even though openapi-typescript did generate real
 * shapes for them (confirmed for several endpoints, e.g. `scopes: unknown[]` for
 * issue-restricted-token) -- deliberately kept as plain `Record`/`unknown` here rather than
 * building a full per-method type-inference layer, because core-api's own `swagger.yaml` has *no*
 * response schemas at all (confirmed: literally `description: 'Placeholder response'` on all ~250
 * response definitions, no `content`/`schema`, no `components.schemas` section in the whole file)
 * -- so a caller must always supply the actual response type `T` by hand regardless, and a
 * half-typed request side without a typed response side buys little for the added complexity.
 * Callers who want the real generated request-body shape for a specific endpoint can still import
 * `operations` from `./core-api.generated` directly and reference it, e.g.
 * `operations["loginPresenterActionIssueRestrictedToken"]["requestBody"]`.
 *
 * `cache: "no-store"` on every request, unconditionally -- brief rule 6.3: "Never cache
 * user-scoped data... A cross-user cache leak here is a security incident, not a bug." Every
 * response from core-api is per-user via the `Authorization` header, so nothing this client
 * fetches is ever a caching candidate; this function does not memoize, dedupe, or wrap fetches in
 * React's `cache()` either, for the same reason -- "no user caching" is a hard rule here, not a
 * missing optimisation.
 *
 * Unwraps core-api's fixed response envelope (`{success, error: {message, code, parameters},
 * payload}`, confirmed directly against `ApiErrorPresenter::sendErrorResponse()`): resolves to
 * `payload` on `success: true`, throws `ApiError` otherwise.
 */
async function request<T>(method: string, path: ApiPath, options: RequestOptions = {}): Promise<T> {
  const session = await requireSession();

  const apiBase = process.env.API_BASE_INTERNAL;
  if (!apiBase) {
    throw new Error("API_BASE_INTERNAL is not set.");
  }

  // `API_BASE_INTERNAL`/`API_BASE_PUBLIC` already include the `/v1` prefix (F-006, every
  // Route Handler in the auth module relies on this: `${apiBase}/login`, etc.), but every path key
  // in the generated `paths` type is absolute from core-api's own root, itself starting with `/v1`
  // (that's how `swagger.yaml` defines them: `/v1/users/{id}`, not `/users/{id}`). Concatenating
  // both verbatim would double up the prefix -- confirmed live, a `/v1/v1/...` URL 404s. Strip it
  // once here rather than changing what `API_BASE_INTERNAL` means, which every already-verified
  // auth route already depends on.
  const resolvedPath = substitutePathParams(path, options.pathParams).replace(/^\/v1(?=\/)/, "");
  const url = `${apiBase}${resolvedPath}${buildQueryString(options.query)}`;

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${session.token}`,
      ...(options.body !== undefined && { "Content-Type": "application/json" }),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("json")) {
    throw new ApiError(
      response.status,
      "unknown",
      `Unexpected non-JSON response (HTTP ${response.status})`,
      null,
    );
  }

  const envelope = (await response.json()) as CoreApiEnvelope<T>;

  if (!envelope.success) {
    throw new ApiError(
      response.status,
      envelope.error?.code ?? "unknown",
      envelope.error?.message ?? "The API call was not successful.",
      envelope.error?.parameters ?? null,
    );
  }

  return envelope.payload as T;
}

export const apiGet = <T>(path: ApiPath, options?: Omit<RequestOptions, "body">): Promise<T> =>
  request<T>("GET", path, options);

export const apiPost = <T>(
  path: ApiPath,
  body?: unknown,
  options?: Omit<RequestOptions, "body">,
): Promise<T> => request<T>("POST", path, { ...options, body });

export const apiPut = <T>(
  path: ApiPath,
  body?: unknown,
  options?: Omit<RequestOptions, "body">,
): Promise<T> => request<T>("PUT", path, { ...options, body });

export const apiPatch = <T>(
  path: ApiPath,
  body?: unknown,
  options?: Omit<RequestOptions, "body">,
): Promise<T> => request<T>("PATCH", path, { ...options, body });

export const apiDelete = <T>(path: ApiPath, options?: Omit<RequestOptions, "body">): Promise<T> =>
  request<T>("DELETE", path, options);
