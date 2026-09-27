# Project Instructions

The approved scope and build contract are [Google ADK AXI MVP scope](docs/scope/google-adk-axi.md) and [Spec 0001](docs/specs/0001-google-adk-axi.md).

Keep the first release limited to local Google ADK Python project listing, inspection, and creation.

Project discovery and inspection must remain structural and must not import or execute discovered agent code.

Project creation must call the installed `adk` CLI noninteractively, pass no credentials, and refuse to overwrite an existing destination.

Return the approved four-field project schema in TOON.

Keep operations stateless, with no daemon or persistent project database.

Tests must use a controlled stand-in for `adk` and must not require network access or real credentials.
