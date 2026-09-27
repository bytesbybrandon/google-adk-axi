import { discoverProjects } from "../domain/project-discovery.js";
export async function homeCommand() {
    const workspace = process.cwd();
    const projects = await discoverProjects(workspace);
    return homeView(workspace, projects);
}
export function homeView(workspace, projects) {
    return {
        workspace,
        projects_found: projects.length,
        projects_message: projectCountMessage(projects.length),
        projects,
        next_step: projects.length === 0
            ? "Run `google-adk-axi projects list --root <path>` to scan another directory or create a project"
            : "Run `google-adk-axi projects inspect " + projects[0].path + "` to inspect a discovered project",
        help: [
            "Run `google-adk-axi projects list [--root <path>]` to list projects",
            "Run `google-adk-axi projects inspect <path>` to inspect one directory",
            "Run `google-adk-axi projects create <name> [--root <path>]` to create a project",
        ],
    };
}
function projectCountMessage(count) {
    return `${count} ${count === 1 ? "item" : "items"} found`;
}
