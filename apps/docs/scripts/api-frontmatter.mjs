/**
 * Post-processes the TypeDoc output for Fumadocs.
 *
 * TypeDoc emits the symbol name as a leading `# H1`, but Fumadocs renders the
 * page heading itself from frontmatter `title` — so without this the pages
 * have no title (the build rejects them) and, once given one, would show the
 * heading twice. This lifts the H1 into frontmatter and drops it from the body.
 *
 * Also writes a meta.json per directory so the ~280 generated pages arrive as
 * a collapsed, grouped section rather than flooding the sidebar.
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const API_DIR = path.join(process.cwd(), "content", "docs", "api");

const PACKAGE_TITLES = {
  core: "@euginejs/core",
  renderer: "@euginejs/renderer",
  "renderer-server": "@euginejs/renderer-server",
  versioning: "@euginejs/versioning",
  eugine: "eugine",
};

const GROUP_TITLES = {
  classes: "Classes",
  functions: "Functions",
  interfaces: "Interfaces",
  "type-aliases": "Type Aliases",
  variables: "Variables",
  src: "Reference",
};

/** First `# Heading` in the body, which TypeDoc uses for the symbol name. */
function takeHeading(body) {
  const match = body.match(/^#\s+(.+?)\s*$/m);
  if (!match) return { title: null, body };
  return { title: match[1], body: body.replace(match[0], "").trimStart() };
}

function splitFrontmatter(source) {
  if (!source.startsWith("---\n")) return { frontmatter: "", body: source };
  const end = source.indexOf("\n---", 4);
  if (end === -1) return { frontmatter: "", body: source };
  return { frontmatter: source.slice(4, end), body: source.slice(end + 4).trimStart() };
}

async function processFile(file) {
  const source = await readFile(file, "utf8");
  const { frontmatter, body } = splitFrontmatter(source);
  if (/^title:/m.test(frontmatter)) return;

  const { title, body: rest } = takeHeading(body);
  const name = path.basename(file, ".mdx");
  const resolved = title ?? (name === "index" ? "API Reference" : name);

  const lines = ["---", `title: ${JSON.stringify(resolved)}`];
  if (frontmatter.trim()) lines.push(frontmatter.trim());
  lines.push("---", "", rest);

  await writeFile(file, lines.join("\n"));
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const dirs = [];

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      dirs.push(entry.name);
      await walk(full);
    } else if (entry.name.endsWith(".mdx")) {
      await processFile(full);
    }
  }

  const relative = path.relative(API_DIR, dir);
  const segment = path.basename(dir);
  const meta = {
    title: relative === "" ? "API Reference" : (PACKAGE_TITLES[segment] ?? GROUP_TITLES[segment] ?? segment),
    // The generated reference is a lookup surface, not a reading path — keep it
    // out of the way until someone opens it.
    defaultOpen: false,
  };
  if (relative === "") meta.icon = "Book";

  await writeFile(path.join(dir, "meta.json"), `${JSON.stringify(meta, null, 2)}\n`);
  return dirs;
}

await walk(API_DIR);
console.log("[api] frontmatter + meta.json written");
