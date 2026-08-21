/**
 * Upload sizing constants, shared by the browser-side orchestrator and the Route Handlers that
 * proxy for it (D-005). Plain module with no `server-only`/`"use client"` marker on purpose --
 * both sides must agree on these numbers, and a client-side check is a UX nicety while the
 * server-side one in `app/api/upload/partial/route.ts` is the one that actually enforces.
 */

/**
 * 512 MiB, the ceiling brief §6.7 names -- verified rather than assumed, against this
 * deployment's own configuration (the compose repo's `services/proxy/nginx.conf.template` and
 * `services/api/nginx-site.conf`: `client_max_body_size 512M`; `services/api/php-recodex.ini`:
 * `upload_max_filesize`/`post_max_size = 512M`). Note core-api's own `actionStartPartial()`
 * declares a *larger* limit (1 GiB), so this deployment's nginx/PHP layer is the binding
 * constraint, not the API -- rejecting at 512 MiB up front turns what would otherwise be an
 * opaque nginx 413 mid-upload into a clear message before a single byte is sent.
 */
export const MAX_UPLOAD_BYTES = 512 * 1024 * 1024;

/**
 * Adaptive chunk sizing, reproducing the legacy app's own values exactly
 * (`repos/web-app/src/containers/UploadContainer/UploadContainer.js`): start at 64 KiB, double
 * after any chunk that took under 2 s, halve after any chunk that took over 4 s, clamped to
 * [4 KiB, 4 MiB]. Brief §6.7 explicitly asks for the legacy chunking behaviour to be found and
 * reproduced rather than reinvented; these are the numbers it was asking about.
 */
export const MIN_CHUNK_BYTES = 4096;
export const MAX_CHUNK_BYTES = MIN_CHUNK_BYTES * 1024;
export const INITIAL_CHUNK_BYTES = 65536;
export const CHUNK_FAST_MS = 2000;
export const CHUNK_SLOW_MS = 4000;

/**
 * core-api's own filename validation (`UploadedFilesPresenter::FILENAME_PATTERN`), mirrored here
 * only to fail fast with a readable message; core-api rejects the same names regardless.
 */
export const FILENAME_PATTERN = /^[a-z0-9\- _.()[\]!]+$/i;
