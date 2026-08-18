import { defineConfig, configDefaults } from "vitest/config";

export default defineConfig({
  test: {
    // No unit tests exist yet (F-024 is next to land real ones). Without this,
    // `vitest run` exits non-zero on an empty suite, which would make F-005's
    // CI pipeline red for a reason unrelated to what it's actually checking. Once
    // real tests are added, this stops mattering -- passWithNoTests is a no-op if
    // any test file matches.
    passWithNoTests: true,
    // Vitest's own default include glob (`**/*.spec.ts` among others) otherwise picks up
    // e2e/smoke.spec.ts (F-023) and tries to run it as a unit test, which fails immediately --
    // Playwright's `test.describe()` refuses to run outside its own runner. e2e/ has its own
    // separate `pnpm test:e2e` entry point; Vitest should never see it.
    exclude: [...configDefaults.exclude, "e2e/**"],
  },
});
