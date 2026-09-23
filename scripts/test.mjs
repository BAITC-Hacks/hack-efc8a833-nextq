import { readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

function findTests(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? findTests(path) : /\.test\.tsx?$/.test(path) ? [path] : [];
  });
}

const tests = findTests("src").sort();
if (tests.length === 0) throw new Error("No unit tests found");
const result = spawnSync(process.execPath, ["--import", "tsx", "--test", ...tests], { stdio: "inherit" });
process.exit(result.status ?? 1);
