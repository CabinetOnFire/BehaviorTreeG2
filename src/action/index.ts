import { getInput, requireInput } from "./inputs";
import { runPublish } from "./publish";
import { runRender } from "./render";

async function main(): Promise<void> {
  const mode = requireInput("mode");
  const token = requireInput("token");
  const directory = getInput("directory") || "bt-diff-out";

  switch (mode) {
    case "render":
      await runRender(token, directory);
      break;
    case "publish":
      await runPublish(token, requireInput("file-house-key"), directory);
      break;
    default:
      console.error(`unknown mode "${mode}", expected "render" or "publish"`);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
