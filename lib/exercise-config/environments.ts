/**
 * Runtime environment ids, and the two rules the simple configuration form has about them
 * (T-009). Both are the legacy app's own lists rather than anything core-api publishes: the API
 * will accept any environment it knows, and it is the *editor* that decides which ones it can
 * express (`SIMPLE_FORM_ENVIRONMENTS`) and which cannot share an exercise with another
 * (`STANDALONE_ENVIRONMENTS`).
 *
 * This deployment has six environments, all of them ordinary; the exclusive ones are carried here
 * so the rule is enforced wherever this runs, and are noted as unverified for the same reason the
 * descriptor table's overrides are.
 */
export const ENV_ARDUINO = "arduino-gcc";
export const ENV_BASH = "bash";
export const ENV_C_GCC = "c-gcc-linux";
export const ENV_CPP_GCC = "cxx-gcc-linux";
export const ENV_CS_DOTNET_CORE = "cs-dotnet-core";
export const ENV_CS_DOTNET_PROJECT = "cs-dotnet-project";
export const ENV_DATA_ONLY = "data-linux";
export const ENV_FREEPASCAL = "freepascal-linux";
export const ENV_GO = "go";
export const ENV_GROOVY = "groovy";
export const ENV_HASKELL = "haskell";
export const ENV_JAVA = "java";
export const ENV_MAVEN = "java-maven";
export const ENV_KOTLIN = "kotlin";
export const ENV_NODEJS = "node-linux";
export const ENV_PHP = "php-linux";
export const ENV_PROLOG = "prolog";
export const ENV_PYTHON3 = "python3";
export const ENV_PYSPARK = "pyspark";
export const ENV_RUST = "rust";
export const ENV_CARGO = "rust-cargo";
export const ENV_SCALA = "scala";
export const ENV_SYCL = "sycl-intel";

export const SIMPLE_FORM_ENVIRONMENTS = [
  ENV_ARDUINO,
  ENV_BASH,
  ENV_C_GCC,
  ENV_CPP_GCC,
  ENV_CS_DOTNET_CORE,
  ENV_CS_DOTNET_PROJECT,
  ENV_DATA_ONLY,
  ENV_FREEPASCAL,
  ENV_GO,
  ENV_GROOVY,
  ENV_HASKELL,
  ENV_JAVA,
  ENV_MAVEN,
  ENV_KOTLIN,
  ENV_NODEJS,
  ENV_PHP,
  ENV_PROLOG,
  ENV_PYTHON3,
  ENV_PYSPARK,
  ENV_RUST,
  ENV_CARGO,
  ENV_SCALA,
  ENV_SYCL,
];

/** Environments that must be the only one an exercise supports. */
export const STANDALONE_ENVIRONMENTS = [
  ENV_ARDUINO,
  ENV_DATA_ONLY,
  ENV_PROLOG,
  ENV_HASKELL,
  ENV_PYSPARK,
];

export function isStandaloneEnvironment(id: string): boolean {
  return STANDALONE_ENVIRONMENTS.includes(id);
}
