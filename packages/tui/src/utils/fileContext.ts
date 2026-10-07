import fs from "node:fs";
import path from "node:path";

export interface AttachedFile {
  path: string;
  absolutePath: string;
  content: string;
  lines: number;
}

/**
 * Extracts tagged files (matching @filepath) from prompt text and loads their contents.
 */
export function parseAndAttachFiles(
  text: string,
  cwd: string = process.cwd()
): { cleanText: string; attachedFiles: AttachedFile[] } {
  // Regex to match @filepath (e.g. @package.json or @packages/core/src/agent.ts)
  const regex = /@([a-zA-Z0-9_./-]+)/g;
  const matches = [...text.matchAll(regex)];

  const attachedFiles: AttachedFile[] = [];

  for (const match of matches) {
    const relativePath = match[1];
    const absolutePath = path.resolve(cwd, relativePath);

    if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile()) {
      try {
        const content = fs.readFileSync(absolutePath, "utf-8");
        const lines = content.split("\n").length;

        // Avoid adding duplicate attachments
        if (!attachedFiles.some((f) => f.path === relativePath)) {
          attachedFiles.push({
            path: relativePath,
            absolutePath,
            content,
            lines,
          });
        }
      } catch {
        // Skip unreadable files
      }
    }
  }

  return { cleanText: text, attachedFiles };
}
