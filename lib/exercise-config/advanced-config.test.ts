import { describe, expect, it } from "vitest";

import {
  assembleConfig,
  configuredEnvironment,
  configuredPipelines,
  possibleEnvironmentVariables,
  readAdvancedConfig,
  writeAdvancedConfig,
} from "./advanced-config";
import type { ExerciseConfig, ExerciseTest } from "./types";

const TESTS: ExerciseTest[] = [
  { id: 1, name: "Test 1", description: "" },
  { id: 2, name: "Test 2", description: "" },
];

/** An advanced configuration: one environment, the same two pipelines under every test. */
const CONFIG: ExerciseConfig = [
  {
    name: "python3",
    tests: [
      {
        name: 1,
        pipelines: [
          {
            name: "compile",
            variables: [{ name: "extra-files", type: "remote-file[]", value: ["a.py"] }],
          },
          {
            name: "run",
            variables: [
              { name: "expected-output", type: "remote-file", value: "one.out" },
              { name: "run-args", type: "string[]", value: ["--fast"] },
            ],
          },
        ],
      },
      {
        name: 2,
        pipelines: [
          {
            name: "compile",
            variables: [{ name: "extra-files", type: "remote-file[]", value: [] }],
          },
          {
            name: "run",
            variables: [
              { name: "expected-output", type: "remote-file", value: "two.out" },
              { name: "run-args", type: "string[]", value: [] },
            ],
          },
        ],
      },
    ],
  },
];

/** What `/config/variables` answers for those two pipelines: names, types and defaults. */
const DECLARED = [
  { id: "compile", variables: [{ name: "extra-files", type: "remote-file[]", value: [] }] },
  {
    id: "run",
    variables: [
      { name: "expected-output", type: "remote-file", value: "" },
      { name: "run-args", type: "string[]", value: [] },
      { name: "judge-type", type: "string", value: "" },
    ],
  },
];

describe("reading an advanced configuration", () => {
  it("names its one environment and its pipeline list", () => {
    expect(configuredEnvironment(CONFIG)).toBe("python3");
    expect(configuredPipelines(CONFIG)).toEqual(["compile", "run"]);
  });

  it("reads nothing out of an empty configuration rather than throwing", () => {
    expect(configuredEnvironment([])).toBeNull();
    expect(configuredPipelines([])).toEqual([]);
  });

  it("keeps what is set and fills the rest from what the pipelines declare", () => {
    const values = readAdvancedConfig(CONFIG, TESTS, "python3", DECLARED);
    const [first] = values.tests;

    expect(first!.pipelines.map((pipeline) => pipeline.id)).toEqual(["compile", "run"]);
    expect(first!.pipelines[1]!.variables.find((v) => v.name === "expected-output")?.value).toBe(
      "one.out",
    );
    // Declared but never set: the pipeline's own default, not absent.
    expect(first!.pipelines[1]!.variables.find((v) => v.name === "judge-type")?.value).toBe("");
    expect(first!.pipelines[1]!.variables).toHaveLength(3);
  });

  it("discards a stored value whose type no longer matches the pipeline's", () => {
    const stale: ExerciseConfig = [
      {
        name: "python3",
        tests: [
          {
            name: 1,
            pipelines: [
              { name: "compile", variables: [] },
              // `run-args` used to be a plain string; the pipeline now wants a list.
              { name: "run", variables: [{ name: "run-args", type: "string", value: "--fast" }] },
            ],
          },
        ],
      },
    ];
    const values = readAdvancedConfig(stale, [TESTS[0]!], "python3", DECLARED);
    expect(
      values.tests[0]!.pipelines[1]!.variables.find((v) => v.name === "run-args")?.value,
    ).toEqual([]);
  });

  it("ignores a pipeline stored in a different position, rather than reading the wrong one", () => {
    const swapped: ExerciseConfig = [
      {
        name: "python3",
        tests: [
          {
            name: 1,
            pipelines: [
              {
                name: "run",
                variables: [{ name: "expected-output", type: "remote-file", value: "x" }],
              },
              { name: "compile", variables: [] },
            ],
          },
        ],
      },
    ];
    const values = readAdvancedConfig(swapped, [TESTS[0]!], "python3", DECLARED);
    // Position 0 holds `run` but the list says `compile`, so nothing is carried over.
    expect(values.tests[0]!.pipelines[0]!.variables[0]!.value).toEqual([]);
  });
});

describe("writing an advanced configuration", () => {
  it("survives a round trip", () => {
    const values = readAdvancedConfig(CONFIG, TESTS, "python3", DECLARED);
    const written = writeAdvancedConfig(values);
    expect(readAdvancedConfig(written, TESTS, "python3", DECLARED)).toEqual(values);
  });

  it("writes exactly one environment, whatever was there before", () => {
    const values = readAdvancedConfig(CONFIG, TESTS, "python3", DECLARED);
    expect(writeAdvancedConfig(values)).toHaveLength(1);
    expect(writeAdvancedConfig(values)[0]!.name).toBe("python3");
  });

  it("keeps test ids numeric, which is how core-api stores them", () => {
    const values = readAdvancedConfig(CONFIG, TESTS, "python3", DECLARED);
    expect(writeAdvancedConfig(values)[0]!.tests.map((test) => test.name)).toEqual([1, 2]);
  });
});

describe("assembling after a structural change", () => {
  it("carries what still applies and defaults the rest", () => {
    const withThird = [
      ...DECLARED,
      { id: "judge", variables: [{ name: "custom-judge", type: "remote-file", value: "" }] },
    ];
    const assembled = assembleConfig(CONFIG, "python3", TESTS, withThird);

    const first = assembled[0]!.tests[0]!;
    expect(first.pipelines.map((pipeline) => pipeline.name)).toEqual(["compile", "run", "judge"]);
    expect(first.pipelines[1]!.variables.find((v) => v.name === "expected-output")?.value).toBe(
      "one.out",
    );
    expect(first.pipelines[2]!.variables[0]!.value).toBe("");
  });

  it("starts from the defaults when the environment changes, since nothing matches", () => {
    const assembled = assembleConfig(CONFIG, "java", TESTS, DECLARED);
    expect(assembled[0]!.name).toBe("java");
    expect(assembled[0]!.tests[0]!.pipelines[1]!.variables[0]!.value).toBe("");
  });
});

describe("possibleEnvironmentVariables", () => {
  const catalogue = [
    {
      id: "compile",
      pipeline: {
        variables: [
          { name: "source-files", type: "file[]", value: "" },
          { name: "run-args", type: "string[]", value: "" },
        ],
      },
    },
    {
      id: "run",
      pipeline: {
        variables: [
          { name: "source-files", type: "file[]", value: "" },
          { name: "entry-point", type: "file", value: "" },
        ],
      },
    },
  ];

  it("offers the file-typed names the chosen pipelines mention, and counts them", () => {
    expect(possibleEnvironmentVariables(catalogue, ["compile", "run"])).toEqual({
      "source-files": 2,
      "entry-point": 1,
    });
  });

  it("offers nothing for a pipeline that is not chosen", () => {
    expect(possibleEnvironmentVariables(catalogue, ["compile"])).toEqual({ "source-files": 1 });
    expect(possibleEnvironmentVariables(catalogue, [])).toEqual({});
  });
});
