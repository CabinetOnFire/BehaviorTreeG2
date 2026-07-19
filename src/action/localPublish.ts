// Local test: publishes a rendered directory against a PR

//   node dist/local-publish.js --pr 7 [--dry-run]
import { OctokitGithubClient } from "./github";
import { publishDiffComment } from "./handler";
import { FileHouseImageHost, type ImageHost } from "./imageHost";
import { createOctokit, repoFromEnv, requireEnv } from "./octokit";
import { loadRenderResult } from "./publish";

/** Uploads for real so image URLs are exercised, but reports the comment instead of posting it. */
class DryRunClient extends OctokitGithubClient {
  async createIssueComment(
    _owner: string,
    _repo: string,
    issueNumber: number,
    body: string,
  ): Promise<void> {
    console.log(`\n--- comment that would be posted on #${issueNumber} ---\n${body}\n---\n`);
  }

  async deleteIssueComment(_owner: string, _repo: string, commentId: number): Promise<void> {
    console.log(`would delete stale comment ${commentId}`);
  }
}

function parseArgs(argv: string[]): { prNumber: number; dryRun: boolean } | null {
  const prIndex = argv.indexOf("--pr");
  if (prIndex === -1) return null;
  const prNumber = Number(argv[prIndex + 1]);
  if (!Number.isInteger(prNumber) || prNumber <= 0) return null;
  return { prNumber, dryRun: argv.includes("--dry-run") };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args) {
    console.error("usage: local-publish --pr <number> [--dry-run]");
    process.exit(1);
  }

  const token = requireEnv("GITHUB_TOKEN");
  const fileHouseKey = requireEnv("FILE_HOUSE_KEY");
  const inDir = process.env.BT_DIFF_OUT ?? "bt-diff-out";
  const { owner, repo } = repoFromEnv();

  const loaded = loadRenderResult(inDir);
  if (!loaded) {
    console.error(`no manifest.json in ${inDir} — run render first`);
    process.exit(1);
  }

  const octokit = createOctokit(token) as unknown as ConstructorParameters<
    typeof OctokitGithubClient
  >[0];
  const client = args.dryRun ? new DryRunClient(octokit) : new OctokitGithubClient(octokit);
  const host: ImageHost = new FileHouseImageHost(fileHouseKey);

  await publishDiffComment(client, host, { owner, repo, prNumber: args.prNumber }, loaded.result);
  console.log(args.dryRun ? "dry run complete, nothing posted" : `published on #${args.prNumber}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
