import { readFile } from "node:fs/promises";
import path from "node:path";
import { ServerCodeBlock } from "fumadocs-ui/components/codeblock.rsc";

const EXAMPLES_DIR = path.join(process.cwd(), "src", "examples");

/**
 * Extracts `// #region <id> ... // #endregion` from a source file, so one
 * real, compiled example can back several prose snippets.
 */
export function extractRegion(source: string, region: string): string {
  const lines = source.split("\n");
  const start = lines.findIndex((line) => line.trim() === `// #region ${region}`);
  if (start === -1) {
    throw new Error(`Region "${region}" not found. Add "// #region ${region}" to the example.`);
  }
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.trim().startsWith("// #endregion"));
  if (end === -1) throw new Error(`Region "${region}" is never closed with "// #endregion".`);

  const body = rest.slice(0, end);
  // Re-indent to the shallowest line so an extracted block doesn't render
  // with the indentation it happened to have inside a function.
  const indent = Math.min(
    ...body.filter((line) => line.trim().length > 0).map((line) => line.length - line.trimStart().length),
  );
  return body.map((line) => line.slice(indent)).join("\n").trim();
}

/** Strips region markers so a whole-file snippet doesn't leak them into the page. */
function stripMarkers(source: string): string {
  return source
    .split("\n")
    .filter((line) => !/^\s*\/\/ #(region|endregion)\b/.test(line))
    .join("\n")
    .trim();
}

export interface CodeFromFileProps {
  /** File under src/examples, with or without the .ts extension. */
  file: string;
  /** Show only this `// #region` block. Omit for the whole file. */
  region?: string;
  title?: string;
  lang?: string;
}

/**
 * Renders a snippet from a REAL TypeScript file that `npm run typecheck`
 * compiles. When the library's API changes under a documented example, the
 * build fails instead of the docs quietly going stale.
 */
export async function CodeFromFile({ file, region, title, lang = "ts" }: CodeFromFileProps) {
  const name = file.endsWith(".ts") ? file : `${file}.ts`;
  const source = await readFile(path.join(EXAMPLES_DIR, name), "utf8");
  const code = region ? extractRegion(source, region) : stripMarkers(source);

  return <ServerCodeBlock code={code} lang={lang} codeblock={{ title: title ?? name }} />;
}
