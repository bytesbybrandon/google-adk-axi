import { spawnSync } from "node:child_process";
import { access, appendFile, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const packageJson = JSON.parse(await readFile(path.join(projectRoot, "package.json"), "utf8"));
const packageLock = JSON.parse(await readFile(path.join(projectRoot, "package-lock.json"), "utf8"));
const npmCli = process.env.npm_execpath;
const keepTarball = process.argv.includes("--keep");

if (!npmCli) {
  throw new Error("Run this check through `npm run verify:package` so it uses the current npm CLI.");
}

if (packageLock.packages?.[""]?.version !== packageJson.version) {
  throw new Error("package.json and package-lock.json versions must match.");
}

for (const sourcePath of ["src/version.js", "src/version.ts"]) {
  const source = await readFile(path.join(projectRoot, sourcePath), "utf8");
  const sourceVersion = source.match(/export\s+const\s+VERSION\s*=\s*["']([^"']+)["']/)?.[1];

  if (sourceVersion !== packageJson.version) {
    throw new Error(`${sourcePath} version must match package.json (${packageJson.version}).`);
  }
}

const allowedFiles = new Set([
  "CODE_OF_CONDUCT.md",
  "CONTRIBUTING.md",
  "LICENSE",
  "README.md",
  "bin/google-adk-axi.js",
  "package.json",
  "src/adapters/adk-cli.js",
  "src/application/create-project.js",
  "src/cli.js",
  "src/commands/home.js",
  "src/commands/projects.js",
  "src/domain/project-discovery.js",
  "src/domain/project.js",
  "src/domain/root-directory.js",
  "src/version.js",
  "src/version.ts",
]);

function runNpm(args, { capture = false, cwd = projectRoot } = {}) {
  const result = spawnSync(process.execPath, [npmCli, ...args], {
    cwd,
    encoding: "utf8",
    stdio: capture ? "pipe" : "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    if (capture) {
      process.stderr.write(result.stdout ?? "");
      process.stderr.write(result.stderr ?? "");
    }

    throw new Error(`npm ${args[0]} failed with exit code ${result.status}.`);
  }

  return result.stdout ?? "";
}

const tempOutputDir = keepTarball
  ? undefined
  : await mkdtemp(path.join(os.tmpdir(), "google-adk-axi-package-"));
const outputDir = tempOutputDir ?? path.join(projectRoot, "dist");
const installDir = await mkdtemp(path.join(os.tmpdir(), "google-adk-axi-install-"));
const tarballName = `${packageJson.name}-${packageJson.version}.tgz`;
const tarballPath = path.join(outputDir, tarballName);

try {
  await mkdir(outputDir, { recursive: true });
  await rm(tarballPath, { force: true });

  const packOutput = runNpm(
    ["pack", "--json", "--ignore-scripts", "--pack-destination", outputDir],
    { capture: true },
  );
  const [packResult] = JSON.parse(packOutput);

  if (packResult.filename !== tarballName) {
    throw new Error(`Expected ${tarballName}, received ${packResult.filename}.`);
  }

  const packedFiles = packResult.files.map(({ path: filePath }) => filePath).sort();
  const unexpectedFiles = packedFiles.filter((filePath) => !allowedFiles.has(filePath));
  const missingFiles = [...allowedFiles].filter((filePath) => !packedFiles.includes(filePath));

  if (unexpectedFiles.length > 0 || missingFiles.length > 0) {
    throw new Error(
      [
        unexpectedFiles.length > 0 ? `Unexpected package files: ${unexpectedFiles.join(", ")}` : "",
        missingFiles.length > 0 ? `Missing package files: ${missingFiles.join(", ")}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  await access(tarballPath);
  await writeFile(
    path.join(installDir, "package.json"),
    JSON.stringify({ name: "google-adk-axi-package-smoke", private: true, version: "1.0.0" }),
  );
  runNpm(["install", "--no-audit", "--no-fund", "--prefix", installDir, tarballPath], {
    cwd: installDir,
  });

  const installedCli = path.join(
    installDir,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "google-adk-axi.cmd" : "google-adk-axi",
  );
  const cliResult = spawnSync(installedCli, ["--version"], {
    cwd: installDir,
    encoding: "utf8",
    shell: process.platform === "win32",
  });

  if (cliResult.error) {
    throw cliResult.error;
  }

  if (cliResult.status !== 0 || cliResult.stdout.trim() !== packageJson.version) {
    throw new Error(
      `Installed CLI smoke check failed. Expected ${packageJson.version}; received ${cliResult.stdout.trim()}.`,
    );
  }

  const relativeTarballPath = path.relative(projectRoot, tarballPath).replaceAll(path.sep, "/");

  if (process.env.GITHUB_OUTPUT) {
    await appendFile(
      process.env.GITHUB_OUTPUT,
      `tarball=${relativeTarballPath}\nversion=${packageJson.version}\n`,
    );
  }

  console.log(`Package verification passed for ${packageJson.name}@${packageJson.version}.`);
  console.log(`Package files: ${packedFiles.join(", ")}`);
  console.log(`Tarball: ${tarballPath}`);
} finally {
  await rm(installDir, { recursive: true, force: true });

  if (tempOutputDir) {
    await rm(tempOutputDir, { recursive: true, force: true });
  }
}
