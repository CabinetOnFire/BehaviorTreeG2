// bt-diff <old.bt.json|none> <new.bt.json|none> [-o out.svg] — "none" means the file
// didn't exist on that side (added/deleted). SVG if -o given, else JSON diff dump.
import * as fs from "fs";
import { parseJsonFile } from "../parser/btJsonParser";
import { diffTree } from "../diff/diff";
import { renderDiffSvg } from "../diff/svg";
import { parseArgs } from "./args";

function main(): void {
  const parsed = parseArgs(process.argv.slice(2));
  if (!parsed) {
    console.error("usage: bt-diff <old.bt.json|none> <new.bt.json|none> [-o out.svg]");
    process.exit(1);
  }
  const { oldPath, newPath, outPath } = parsed;

  const oldRoot = oldPath === "none" ? null : parseJsonFile(fs.readFileSync(oldPath, "utf8")).root;
  const newRoot = newPath === "none" ? null : parseJsonFile(fs.readFileSync(newPath, "utf8")).root;
  const diff = diffTree(oldRoot, newRoot);

  if (outPath) {
    fs.writeFileSync(outPath, renderDiffSvg(diff));
    console.error(`wrote ${outPath}`);
  } else {
    console.log(JSON.stringify(diff, null, 2));
  }
}

main();
