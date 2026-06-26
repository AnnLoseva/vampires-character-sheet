import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type JsonObject = Record<string, unknown>;

type Summary = {
  totalPowers: number;
  auto: number;
  partial: number;
  manual: number;
  missingMechanics: number;
};

const REQUIRED_AUTO_FIELDS = [
  "identity",
  "activation",
  "cost",
  "duration",
  "effects",
  "ui",
] as const;

const isObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasValue = (object: JsonObject, field: string): boolean => {
  if (!Object.prototype.hasOwnProperty.call(object, field)) {
    return false;
  }

  const value = object[field];
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  return true;
};

const formatPowerLocation = (
  discipline: string,
  path: string,
  level: string,
  power: string,
): string =>
  [discipline, path, `level ${level}`, power].filter(Boolean).join(" / ");

function getPowerContainer(value: JsonObject): unknown {
  if (isObject(value.powers)) return value.powers;
  const levelEntries = Object.entries(value).filter(([key]) =>
    Number.isFinite(Number(key))
  );
  return levelEntries.length > 0
    ? Object.fromEntries(levelEntries)
    : undefined;
}

function validatePower(
  discipline: string,
  path: string,
  level: string,
  powerName: string,
  power: JsonObject,
  summary: Summary,
  errors: string[],
): void {
  summary.totalPowers += 1;
  const location = formatPowerLocation(discipline, path, level, powerName);

  if (!Object.prototype.hasOwnProperty.call(power, "mechanics")) {
    summary.missingMechanics += 1;
    console.warn(`WARNING: ${location}: missing mechanics.`);
    return;
  }

  if (!isObject(power.mechanics)) {
    errors.push(`${location}: mechanics must be an object.`);
    return;
  }

  const mechanics = power.mechanics;
  if (mechanics.automation === undefined) {
    summary.partial += 1;
    console.warn(
      `WARNING: ${location}: mechanics.automation.status is missing; counted as partial.`,
    );
    return;
  }

  if (!isObject(mechanics.automation)) {
    errors.push(`${location}: mechanics.automation must be an object.`);
    return;
  }

  const status = mechanics.automation.status;
  if (status !== "auto" && status !== "partial" && status !== "manual") {
    errors.push(
      `${location}: mechanics.automation.status must be "auto", "partial", or "manual".`,
    );
    return;
  }

  summary[status] += 1;

  if (status !== "auto") {
    return;
  }

  const missingFields = REQUIRED_AUTO_FIELDS.filter(
    (field) => !hasValue(mechanics, field),
  );

  if (missingFields.length > 0) {
    errors.push(
      `${location}: auto mechanics is missing required fields: ${missingFields.join(", ")}.`,
    );
  }
}

function validatePowers(
  discipline: string,
  path: string,
  powers: unknown,
  summary: Summary,
  errors: string[],
): void {
  if (powers === undefined) {
    return;
  }

  if (!isObject(powers)) {
    errors.push(
      `${discipline}${path ? ` / ${path}` : ""}: powers must be an object.`,
    );
    return;
  }

  for (const [level, levelPowers] of Object.entries(powers)) {
    if (!isObject(levelPowers)) {
      errors.push(
        `${discipline}${path ? ` / ${path}` : ""} / level ${level}: powers must be an object.`,
      );
      continue;
    }

    for (const [powerName, power] of Object.entries(levelPowers)) {
      if (!isObject(power)) {
        errors.push(
          `${formatPowerLocation(discipline, path, level, powerName)}: power must be an object.`,
        );
        continue;
      }

      validatePower(
        discipline,
        path,
        level,
        powerName,
        power,
        summary,
        errors,
      );
    }
  }
}

function main(): void {
  const rulesPath = resolve(process.cwd(), "public/rules.json");
  const rules = JSON.parse(readFileSync(rulesPath, "utf8")) as unknown;

  if (!isObject(rules) || !isObject(rules.disciplines)) {
    throw new Error(`Expected "${rulesPath}" to contain a disciplines object.`);
  }

  const summary: Summary = {
    totalPowers: 0,
    auto: 0,
    partial: 0,
    manual: 0,
    missingMechanics: 0,
  };
  const errors: string[] = [];

  console.log(`Discipline mechanics validation: ${rulesPath}\n`);

  for (const [disciplineName, discipline] of Object.entries(
    rules.disciplines,
  )) {
    if (!isObject(discipline)) {
      errors.push(`${disciplineName}: discipline must be an object.`);
      continue;
    }

    validatePowers(
      disciplineName,
      "",
      discipline.powers,
      summary,
      errors,
    );

    if (discipline.paths === undefined) {
      continue;
    }

    if (!isObject(discipline.paths)) {
      errors.push(`${disciplineName}: paths must be an object.`);
      continue;
    }

    for (const [pathName, path] of Object.entries(discipline.paths)) {
      if (!isObject(path)) {
        errors.push(`${disciplineName} / ${pathName}: path must be an object.`);
        continue;
      }

      validatePowers(
        disciplineName,
        pathName,
        getPowerContainer(path),
        summary,
        errors,
      );
    }
  }

  for (const error of errors) {
    console.error(`ERROR: ${error}`);
  }

  console.log("\nSummary");
  console.log(`- total powers: ${summary.totalPowers}`);
  console.log(`- auto: ${summary.auto}`);
  console.log(`- partial: ${summary.partial}`);
  console.log(`- manual: ${summary.manual}`);
  console.log(`- missing mechanics: ${summary.missingMechanics}`);

  if (errors.length > 0) {
    console.error(`\nValidation failed with ${errors.length} error(s).`);
    process.exitCode = 1;
    return;
  }

  console.log("\nValidation passed with warnings allowed.");
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Discipline mechanics validation failed: ${message}`);
  process.exitCode = 1;
}
