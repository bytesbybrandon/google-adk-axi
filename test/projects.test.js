import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createAdkEnvironment } from "../src/adapters/adk-cli.js";
import { createProject } from "../src/application/create-project.js";
import { discoverProjects, inspectProject } from "../src/domain/project-discovery.js";
import { homeView } from "../src/commands/home.js";
import { projectsCommand } from "../src/commands/projects.js";

test("discovery finds code projects recursively and skips hidden and generated folders", async (context) => {
  const root = await createTempDirectory();
  const external = await createTempDirectory();
  context.after(async () => {
    await rm(root, { recursive: true, force: true });
    await rm(external, { recursive: true, force: true });
  });

  await writeFile(join(root, "agent.py"), "# root is not a child project\n");
  await writeFile(join(await makeDirectory(root, "Alpha"), "agent.py"), "# agent\n");
  await writeFile(join(await makeDirectory(root, "Missing"), "__init__.py"), "from . import agent\n");
  await writeFile(join(await makeDirectory(root, "MissingDirect"), "__init__.py"), "from .agent import root_agent\n");
  await writeFile(join(await makeDirectory(root, "Plain"), "__init__.py"), "VALUE = 1\n");
  await writeFile(join(await makeDirectory(root, "nested", "Nested"), "agent.py"), "# agent\n");
  await writeFile(join(await makeDirectory(root, ".hidden", "Hidden"), "agent.py"), "# agent\n");
  await writeFile(join(await makeDirectory(root, "node_modules", "Generated"), "agent.py"), "# agent\n");
  for (const generatedDirectory of [".git", ".venv", "venv", "dist", "build", "__pycache__"]) {
    await writeFile(join(await makeDirectory(root, generatedDirectory, "Generated"), "agent.py"), "# agent\n");
  }
  await writeFile(join(external, "agent.py"), "# agent\n");

  const linkPath = join(root, "linked");
  try {
    await symlink(external, linkPath, process.platform === "win32" ? "junction" : "dir");
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
    if (!new Set(["EPERM", "EACCES", "ENOSYS"]).has(String(code))) throw error;
  }

  const projects = await discoverProjects(root);
  assert.deepEqual(projects.map(({ name }) => name), ["Alpha", "Missing", "MissingDirect", "Nested"]);
  for (const project of projects) {
    assert.deepEqual(Object.keys(project).sort(), ["entrypoint", "name", "path", "status"]);
  }
  assert.equal(projects[0].status, "ready");
  assert.equal(projects[0].entrypoint, "agent.py");
  assert.equal(projects[1].status, "missing-entrypoint");
  assert.equal(projects[1].entrypoint, null);
  assert.equal(projects[2].status, "missing-entrypoint");
});

test("inspection accepts any existing directory and reports missing entrypoints", async (context) => {
  const root = await createTempDirectory();
  context.after(() => rm(root, { recursive: true, force: true }));
  const empty = await makeDirectory(root, "empty");

  assert.deepEqual(await inspectProject(empty), {
    name: "empty",
    path: empty,
    entrypoint: null,
    status: "missing-entrypoint",
  });
  await assert.rejects(inspectProject(join(root, "absent")), { code: "NOT_FOUND" });
});

test("projects list command returns discovered rows", async (context) => {
  const root = await createTempDirectory();
  context.after(() => rm(root, { recursive: true, force: true }));
  const projectPath = await makeDirectory(root, "Agent");
  await writeFile(join(projectPath, "agent.py"), "# agent\n");

  const result = await projectsCommand(["list", "--root", root]);
  assert.equal(result.projects_found, 1);
  assert.equal(result.projects_message, "1 item found");
  assert.deepEqual(result.projects, [{
    name: "Agent",
    path: projectPath,
    entrypoint: "agent.py",
    status: "ready",
  }]);
});

test("projects list reports an explicit empty state", async (context) => {
  const root = await createTempDirectory();
  context.after(() => rm(root, { recursive: true, force: true }));

  const result = await projectsCommand(["list", "--root", root]);
  assert.equal(result.projects_found, 0);
  assert.equal(result.projects_message, "0 items found");
  assert.deepEqual(result.projects, []);
});

test("projects command rejects missing actions, arguments, and unknown options", async () => {
  await assert.rejects(projectsCommand([]), { code: "VALIDATION_ERROR" });
  await assert.rejects(projectsCommand(["inspect"]), { code: "VALIDATION_ERROR" });
  await assert.rejects(projectsCommand(["create"]), { code: "VALIDATION_ERROR" });
  await assert.rejects(projectsCommand(["list", "--unknown"]), { code: "VALIDATION_ERROR" });
});

test("home view states the empty result and offers a next step", () => {
  const home = homeView("/workspace", []);
  assert.equal(home.projects_found, 0);
  assert.equal(home.projects_message, "0 items found");
  assert.match(home.next_step, /projects list/);
});

test("create invokes ADK with noninteractive code-project arguments and returns its path", async (context) => {
  const root = await createTempDirectory();
  context.after(() => rm(root, { recursive: true, force: true }));
  let observed;

  const spawnPort = (command, args, options) => {
    observed = { command, args, options };
    const child = new EventEmitter();
    setImmediate(async () => {
      const targetPath = join(options.cwd, args.at(-1));
      await writeFile(join(targetPath, "agent.py"), "# generated by controlled ADK stub\n");
      child.emit("close", 0, null);
    });
    return child;
  };

  const project = await createProject("Demo_agent-1", root, spawnPort);
  assert.equal(project.path, join(root, "Demo_agent-1"));
  assert.equal(project.status, "ready");
  assert.equal(await readFile(join(project.path, "agent.py"), "utf8"), "# generated by controlled ADK stub\n");
  assert.equal(observed.command, "adk");
  assert.deepEqual(observed.args, ["create", "--model", "<FILL_IN_MODEL>", "--type", "CODE", "Demo_agent-1"]);
  assert.equal(observed.options.cwd, root);
  assert.equal(observed.options.shell, false);
  assert.equal(observed.options.stdio[0], "ignore");
  assert.equal("GOOGLE_API_KEY" in observed.options.env, false);
  assert.equal("GOOGLE_APPLICATION_CREDENTIALS" in observed.options.env, false);
});

test("create filters credentials and forces UTF-8 for ADK output", () => {
  const environment = createAdkEnvironment({
    PATH: "safe-path",
    PATHEXT: ".EXE",
    SYSTEMROOT: "system-root",
    HOME: "safe-home",
    USERPROFILE: "safe-profile",
    HOMEDRIVE: "C:",
    HOMEPATH: "\\Users\\test",
    PYTHONIOENCODING: "cp1252",
    GOOGLE_API_KEY: ["must", "not-pass"].join("-"),
    GOOGLE_APPLICATION_CREDENTIALS: "must-not-pass",
    GOOGLE_CLOUD_PROJECT: "must-not-pass",
    NODE_AUTH_TOKEN: ["must", "not-pass"].join("-"),
  });

  assert.deepEqual(environment, {
    PATH: "safe-path",
    PATHEXT: ".EXE",
    SYSTEMROOT: "system-root",
    HOME: "safe-home",
    USERPROFILE: "safe-profile",
    HOMEDRIVE: "C:",
    HOMEPATH: "\\Users\\test",
    PYTHONIOENCODING: "utf-8",
  });
});

test("create rejects invalid names and existing destinations without invoking ADK", async (context) => {
  const root = await createTempDirectory();
  context.after(() => rm(root, { recursive: true, force: true }));
  await makeDirectory(root, "existing");
  let spawnCalls = 0;
  const spawnPort = () => {
    spawnCalls += 1;
    throw new Error("ADK should not have been called");
  };

  await assert.rejects(createProject("../escape", root, spawnPort), { code: "VALIDATION_ERROR" });
  await assert.rejects(createProject("user", root, spawnPort), { code: "VALIDATION_ERROR" });
  await assert.rejects(createProject("existing", root, spawnPort), { code: "ALREADY_EXISTS" });
  assert.equal(spawnCalls, 0);
});

test("missing ADK is reported and its empty reservation is removed", async (context) => {
  const root = await createTempDirectory();
  context.after(() => rm(root, { recursive: true, force: true }));
  const spawnPort = () => {
    const child = new EventEmitter();
    setImmediate(() => child.emit("error", Object.assign(new Error("not found"), { code: "ENOENT" })));
    return child;
  };

  await assert.rejects(createProject("missing-adk", root, spawnPort), { code: "DEPENDENCY_MISSING" });
  await assert.rejects(import("node:fs/promises").then(({ stat }) => stat(join(root, "missing-adk"))), { code: "ENOENT" });
});

test("ADK process failure returns an actionable error and removes an empty reservation", async (context) => {
  const root = await createTempDirectory();
  context.after(() => rm(root, { recursive: true, force: true }));
  const spawnPort = () => {
    const child = new EventEmitter();
    setImmediate(() => child.emit("close", 7, null));
    return child;
  };

  await assert.rejects(createProject("failed-adk", root, spawnPort), {
    code: "ADK_ERROR",
    message: /exit code 7/,
  });
  await assert.rejects(import("node:fs/promises").then(({ stat }) => stat(join(root, "failed-adk"))), { code: "ENOENT" });
});

test("create rejects ADK success without an agent.py entrypoint", async (context) => {
  const root = await createTempDirectory();
  context.after(() => rm(root, { recursive: true, force: true }));
  const spawnPort = () => {
    const child = new EventEmitter();
    setImmediate(() => child.emit("close", 0, null));
    return child;
  };

  await assert.rejects(createProject("no-entrypoint", root, spawnPort), { code: "ADK_ERROR" });
});

async function createTempDirectory() {
  return mkdtemp(join(tmpdir(), "google-adk-axi-"));
}

async function makeDirectory(root, ...parts) {
  const directory = join(root, ...parts);
  await mkdir(directory, { recursive: true });
  return directory;
}
