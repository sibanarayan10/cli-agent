import fs from "node:fs";
import path from "node:path";

const IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  ".bun",
  "dist",
  "build",
  "coverage",
  ".next",
  ".cache",
]);

const IGNORE_FILES = new Set([
  ".DS_Store",
  "bun.lock",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
]);

/**
 * Recursively scans workspace for file paths relative to root directory.
 */
export function scanWorkspaceFiles(
  rootDir: string = process.cwd(),
  maxDepth: number = 6
): string[] {
  const files: string[] = [];

  function traverse(currentDir: string, depth: number) {
    if (depth > maxDepth) return;

    try {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        if (IGNORE_DIRS.has(entry.name) || IGNORE_FILES.has(entry.name)) {
          continue;
        }

        const fullPath = path.join(currentDir, entry.name);
        const relativePath = path.relative(rootDir, fullPath);

        if (entry.isDirectory()) {
          traverse(fullPath, depth + 1);
        } else if (entry.isFile()) {
          files.push(relativePath);
        }
      }
    } catch {
      // Ignore unreadable directories/files
    }
  }

  traverse(rootDir, 0);
  return files.sort();
}
