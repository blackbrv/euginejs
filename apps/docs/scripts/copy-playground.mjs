import { rmSync, cpSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const playgroundDist = join(__dirname, "../../playground/dist");
const target = join(__dirname, "../public/playground");

rmSync(target, { recursive: true, force: true });
cpSync(playgroundDist, target, { recursive: true });
