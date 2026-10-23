// Minimal typed Node fs access for tests (the project has no @types/node).
declare const __dirname: string;

type NodeFs = {
  readFileSync(path: string, encoding: "utf8"): string;
  writeFileSync(path: string, data: string, encoding: "utf8"): void;
};

export const fs = jest.requireActual<NodeFs>("fs");
const path = jest.requireActual<{ join(...parts: string[]): string }>("path");

// Absolute path from the repository root.
export function repoPath(relative: string): string {
  return path.join(__dirname, "../../../..", relative);
}
