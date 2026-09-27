import { stat } from "node:fs/promises";
import { AxiError } from "axi-sdk-js";
export async function assertExistingDirectory(path, label) {
    try {
        if (!(await stat(path)).isDirectory()) {
            throw new AxiError(`${label} is not a directory: ${path}`, "VALIDATION_ERROR");
        }
    }
    catch (error) {
        if (error instanceof AxiError)
            throw error;
        if (errorCode(error) === "ENOENT") {
            throw new AxiError(`${label} does not exist: ${path}`, "NOT_FOUND", [
                "Provide an existing directory path",
            ]);
        }
        throw new AxiError(`Could not access ${label.toLowerCase()} ${path}`, "FILESYSTEM_ERROR");
    }
}
function errorCode(error) {
    return typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : undefined;
}
