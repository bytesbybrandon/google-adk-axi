# Google ADK AXI MVP Scope

## Feature

Project management for Google ADK Python agent projects.

## Intent

Provide an agent-oriented CLI for discovering, inspecting, and creating local Google ADK agent projects.

## Delivery

- Approach: MVP.
- Tier: Beta.

Status: Complete.

## In scope

- List local agent projects with the approved fields: `name`, `path`, `entrypoint`, and `status`.
- Report project status as `ready` or `missing-entrypoint`.
- Inspect a selected project.
- Create a local ADK agent project.
- Return concise structured results and actionable errors.
- Verify behavior with an automated test suite.
- Use direct CLI calls without a background daemon.

## Out of scope

- Running agent conversations.
- Managing long-running ADK web or API servers.
- Deploying agents.
- Supporting non-Python ADK command surfaces.

## Acceptance seeds

1. Listing returns local projects using the approved four-field schema.
2. Inspection identifies the selected project and its readiness status.
3. Creation reports the new project path or an actionable error.
4. Automated tests cover success and failure behavior for list, inspect, and create.

## Ordered milestones

1. Finalize the command surface and project readiness rules during design.
2. Implement project listing, inspection, and creation.
3. Verify behavior and add the Beta test suite.
4. Complete review and user-facing documentation.

## Next phase

AXI runtime sync, pending user approval.
