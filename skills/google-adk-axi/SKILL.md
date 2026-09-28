---
name: google-adk-axi
description: Manage local Google ADK Python projects through the google-adk-axi CLI.
---

# Google ADK AXI

Use the CLI to list, inspect, and create local Google ADK Python projects.

Run `google-adk-axi projects list [--root <path>]` to discover projects below a directory.

Run `google-adk-axi projects inspect <path>` to inspect one project directory.

Run `google-adk-axi projects create <name> [--root <path>]` to create a code project through the installed ADK CLI.

Discovery is structural and never imports or executes agent code.

Configure a model and authentication before running a newly created agent.
