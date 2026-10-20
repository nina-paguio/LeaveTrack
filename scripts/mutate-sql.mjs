#!/usr/bin/env node
// Mutation-tests the rolled-back SQL tests. For each mutant it runs the matching verify-*.sql with a
// broken copy of the function swapped in (create or replace, inside the test's own transaction, which
// always rolls back), and requires VERIFY_FAILED. Nothing is ever committed.
//
//   node scripts/mutate-sql.mjs decide|audit|team|accrual|notify-submit|notify-decide|notify-list|notify-count|notify-read|retention|all
//
// Needs the Supabase CLI and DATABASE_URL in .env.local (the session-mode port 5432 is derived).
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { targets } from "./mutants.mjs";

function dbUrl() {
  const line = readFileSync(".env.local", "utf8")
    .split("\n")
    .find((l) => /^\s*DATABASE_URL\s*=/.test(l));
  if (!line) throw new Error("DATABASE_URL is not set in .env.local");
  const u = new URL(line.split("=").slice(1).join("=").trim());
  if (u.port === "6543") u.port = "5432"; // migrations and DDL need session mode
  return u.toString();
}

const strip = (file) =>
  readFileSync(file, "utf8")
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n")
    .trim()
    .replace(/;\s*$/, "");

// Safety: this script runs DDL (drop / create or replace) on live functions inside transactions that
// always roll back. Harmless on a dev database, but it would briefly lock the functions production
// traffic is calling. Never point it at production.
const envFile = readFileSync(".env.local", "utf8");
const appEnvLines = [...envFile.matchAll(/^\s*APP_ENV\s*=\s*"?([A-Za-z]+)"?/gm)].map((m) => m[1]);
const appEnv = process.env.APP_ENV ?? appEnvLines.at(-1) ?? "dev"; // last duplicate wins, like dotenv
if (appEnv === "prod") {
  console.error(
    "Refusing to run: APP_ENV=prod in .env.local. Run mutation tests against a dev database only.",
  );
  process.exit(2);
}
const url = dbUrl();
console.log(
  "target: " +
    new URL(url).username.replace(/^postgres\./, "project ") +
    " (APP_ENV=" +
    appEnv +
    ")",
);
const run = (sql) => {
  let out = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    const r = spawnSync("supabase", ["db", "query", "--db-url", url, sql], { encoding: "utf8" });
    out = (r.stdout + r.stderr).replace(/postgres(ql)?:\/\/[^\s"]+/g, "<url>");
    if (!out.includes("DbConnectError")) break; // the pooler drops a connection now and then: retry
  }
  return out;
};
const outcome = (out) =>
  (out.match(/VERIFY_(OK|FAILED)[^"\\]*/) || ["UNEXPECTED: " + out.slice(0, 160)])[0];

const wanted = process.argv[2];
const names = wanted === "all" ? Object.keys(targets) : [wanted];
if (!wanted || names.some((n) => !targets[n])) {
  console.error("usage: node scripts/mutate-sql.mjs " + Object.keys(targets).join("|") + "|all");
  process.exit(2);
}

let bad = 0;
for (const name of names) {
  const t = targets[name];
  const base = strip(t.test);
  const migration = readFileSync(t.migration, "utf8");
  const body = migration.match(
    new RegExp(`create (?:or replace )?function ${t.fn}\\(?[\\s\\S]*?\\n\\$\\$;`),
  );
  if (!body) throw new Error(`function ${t.fn} not found in ${t.migration}`);
  const fn = body[0]
    .replace(/create (?:or replace )?function/, "create or replace function")
    .replaceAll("$$", "$f$");

  console.log(`\n== ${name}: the real function must pass ${t.test}`);
  const real = outcome(run(base));
  console.log("   " + real.slice(0, 100));
  if (!real.startsWith("VERIFY_OK")) bad++;

  console.log(`== ${name}: ${Object.keys(t.mutants).length} mutants (each must be caught)`);
  for (const [label, mutate] of Object.entries(t.mutants)) {
    const mutated = mutate(fn);
    if (mutated === fn) {
      console.log(`   SKIP   ${label}  (mutation did not apply: the migration changed)`);
      bad++;
      continue;
    }
    const res = outcome(run(base.replace(/^begin\n/m, "begin\n" + mutated + "\n")));
    const caught = res.startsWith("VERIFY_FAILED");
    if (!caught) bad++;
    console.log(`   ${caught ? "CAUGHT" : "MISSED"} ${label}\n          -> ${res.slice(0, 110)}`);
  }
}
console.log(
  bad ? `\n${bad} problem(s): see MISSED/SKIP/real-function lines above` : "\nall mutants caught",
);
process.exit(bad ? 1 : 0);
