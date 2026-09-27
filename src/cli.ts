import { runAxiCli } from "axi-sdk-js";
import { encode } from "@toon-format/toon";
import { homeCommand } from "./commands/home.js";
import { projectsCommand, projectsHelp } from "./commands/projects.js";
import { VERSION } from "./version.js";

const description = "Agent interface for local Google ADK Python projects.";

const topLevelHelp = [
  "google-adk-axi",
  "",
  description,
  "",
  "Commands:",
  "  projects list [--root <path>]       Discover ADK projects",
  "  projects inspect <path>             Inspect one project directory",
  "  projects create <name> [--root <path>]  Create a project with ADK",
  "",
  "Run `google-adk-axi projects --help` for project command details.",
].join("\n");

export async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const leadingArgument = argv[0];
  const knownLeadingFlag = ["--help", "-v", "-V", "--version"].includes(leadingArgument ?? "");
  if (leadingArgument?.startsWith("-") && !(argv.length === 1 && knownLeadingFlag)) {
    process.stdout.write(`${encode({
      error: `Unknown global option: ${leadingArgument}`,
      code: "VALIDATION_ERROR",
      help: [
        "Supported flags: --help, -v, -V, --version",
        "Valid command: projects",
      ],
    })}\n`);
    process.exitCode = 2;
    return;
  }

  await runAxiCli({
    description,
    version: VERSION,
    argv,
    topLevelHelp,
    home: homeCommand,
    commands: {
      projects: projectsCommand,
    },
    getCommandHelp: (command) => command === "projects" ? projectsHelp : null,
  });
}
