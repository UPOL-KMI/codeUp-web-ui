import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // No unit tests exist yet (F-023/F-024 land the test harness later). Without
    // this, `vitest run` exits non-zero on an empty suite, which would make F-005's
    // CI pipeline red for a reason unrelated to what it's actually checking. Once
    // real tests are added, this stops mattering -- passWithNoTests is a no-op if
    // any test file matches.
    passWithNoTests: true,
  },
});
