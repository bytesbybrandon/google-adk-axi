import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { fileURLToPath } from "node:url";
import { decode } from "@toon-format/toon";
import { test } from "node:test";

const cliPath = fileURLToPath(new URL("../bin/google-adk-axi.js", import.meta.url));

test("local fast version path prints the configured version", () => {
  const result = spawnSync(process.execPath, [cliPath, "--version"], { encoding: "utf8" });
  assert.equal(result.status, 0);
  assert.equal(result.stdout, "0.1.0\n");
  assert.equal(result.stderr, "");
});

test("no-argument CLI emits TOON workspace data with an empty state and next step", async (context) => {
  const workspace = await mkdtemp(join(tmpdir(), "google-adk-axi-home-"));
  context.after(() => rm(workspace, { recursive: true, force: true }));

  const result = spawnSync(process.execPath, [cliPath], { cwd: workspace, encoding: "utf8" });
  assert.equal(result.status, 0);
  const output = decode(result.stdout);
  assert.equal(output.workspace, workspace);
  assert.equal(output.projects_found, 0);
  assert.equal(output.projects_message, "0 items found");
  assert.match(output.next_step, /projects list/);
  assert.deepEqual(output.projects, []);
});

test("project list CLI reports an explicit empty state in TOON", async (context) => {
  const workspace = await mkdtemp(join(tmpdir(), "google-adk-axi-list-"));
  context.after(() => rm(workspace, { recursive: true, force: true }));

  const result = spawnSync(process.execPath, [cliPath, "projects", "list", "--root", workspace], {
    cwd: workspace,
    encoding: "utf8",
  });
  assert.equal(result.status, 0);
  const output = decode(result.stdout);
  assert.equal(output.projects_found, 0);
  assert.equal(output.projects_message, "0 items found");
  assert.deepEqual(output.projects, []);
});

test("project inspect accepts a relative path that begins with a dash", async (context) => {
  const workspace = await mkdtemp(join(tmpdir(), "google-adk-axi-inspect-"));
  context.after(() => rm(workspace, { recursive: true, force: true }));
  await mkdir(join(workspace, "-workspace"));

  const result = spawnSync(process.execPath, [cliPath, "projects", "inspect", "-workspace"], {
    cwd: workspace,
    encoding: "utf8",
  });
  assert.equal(result.status, 0);
  const output = decode(result.stdout);
  assert.equal(output.name, "-workspace");
  assert.equal(output.status, "missing-entrypoint");
});

test("unknown leading flag returns a structured validation error with valid flags and exit code 2", () => {
  const result = spawnSync(process.execPath, [cliPath, "--unknown-flag"], { encoding: "utf8" });
  assert.equal(result.status, 2);
  const output = decode(result.stdout);
  assert.equal(output.code, "VALIDATION_ERROR");
  assert.match(output.error, /Unknown global option/);
  assert.match(output.help[0], /Supported flags: --help, -v, -V, --version/);
});

test("CLI create explains when failed ADK generation leaves partial files", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "google-adk-axi-create-failure-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const diagnostic = "\u001b[31mADK rejected the configured model; GOOGLE_API_KEY=super-secret-value\u001b[0m\n";
  const adkBin = await installFailingAdkStub(root, diagnostic);

  const projectName = "PartialFailure";
  const targetPath = join(root, projectName);
  const result = spawnSync(process.execPath, [cliPath, "projects", "create", projectName, "--root", root], {
    cwd: root,
    env: {
      ...process.env,
      PATH: [adkBin, process.env.PATH ?? ""].join(delimiter),
    },
    encoding: "utf8",
  });

  const output = decode(result.stdout);
  assert.notEqual(result.status, 0);
  assert.equal(output.code, "ADK_ERROR");
  assert.match(output.error, /ADK rejected the configured model/);
  assert.match(output.help.join("\n"), /inspect|review/i);
  assert.ok(output.help.join("\n").includes(targetPath));
  assert.doesNotMatch(output.error, /super-secret-value/);
  assert.doesNotMatch(output.error, /\u001b/);
});

test("CLI omits truncated ADK diagnostics that cross a private-key boundary", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "google-adk-axi-create-long-error-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const privateKeyHeader = ["-----BEGIN", "PRIVATE KEY-----"].join(" ");
  const privateKey = `${privateKeyHeader}\n${"A".repeat(6000)}`;
  const adkBin = await installFailingAdkStub(root, privateKey);

  const result = spawnSync(process.execPath, [cliPath, "projects", "create", "LongFailure", "--root", root], {
    cwd: root,
    env: { ...process.env, PATH: [adkBin, process.env.PATH ?? ""].join(delimiter) },
    encoding: "utf8",
  });

  const output = decode(result.stdout);
  assert.notEqual(result.status, 0);
  assert.doesNotMatch(output.error, /A{100}/);
  assert.match(output.error, /diagnostic exceeded.*omitted/i);
});

test("CLI redacts an unterminated private key from a bounded ADK diagnostic", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "google-adk-axi-create-key-error-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const privateKeyHeader = ["-----BEGIN", "PRIVATE KEY-----"].join(" ");
  const privateKey = ["ADK error", privateKeyHeader, "private-material\n".repeat(8)].join("\n");
  const adkBin = await installFailingAdkStub(root, privateKey);

  const result = spawnSync(process.execPath, [cliPath, "projects", "create", "KeyFailure", "--root", root], {
    cwd: root,
    env: { ...process.env, PATH: [adkBin, process.env.PATH ?? ""].join(delimiter) },
    encoding: "utf8",
  });

  const output = decode(result.stdout);
  assert.notEqual(result.status, 0);
  assert.doesNotMatch(output.error, /private-material/);
  assert.match(output.error, /\[redacted private key\]/);
});

async function installFailingAdkStub(root, diagnostic) {
  const adkBin = join(root, "bin");
  await mkdir(adkBin);
  const stubSource = [
    "const { writeFileSync } = require('node:fs');",
    "const { join } = require('node:path');",
    "const projectName = process.argv.at(-1);",
    "writeFileSync(join(process.cwd(), projectName, 'partial.txt'), 'partial output');",
    `process.stderr.write(${JSON.stringify(diagnostic)});`,
    "process.exit(7);",
  ].join("\n");

  if (process.platform === "win32") {
    await copyFile(process.execPath, join(adkBin, "adk.exe"));
    await writeFile(join(root, "create"), stubSource);
  } else {
    await writeFile(join(adkBin, "adk"), `#!/usr/bin/env node\n${stubSource}\n`, { mode: 0o755 });
  }
  return adkBin;
}
