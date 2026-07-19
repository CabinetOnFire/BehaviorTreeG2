// Runs on `pull_request`, where a fork PR gets a read-only token and no secrets. So this
// only reads and renders, leaving anything that needs write access to the publish step.
import * as fs from "fs";
import * as path from "path";
import { OctokitGithubClient } from "./github";
import { renderPullRequestDiffs } from "./handler";
import { createOctokit, readEventPayload, repoFromEnv } from "./octokit";

interface PullRequestEvent {
  pull_request: { number: number; base: { sha: string }; head: { sha: string } };
}

/** Index of the rendered output. The SVGs live beside it as separate files. */
export interface Manifest {
  prNumber: number;
  truncated: number;
  files: Array<{ path: string; note?: string; failed?: boolean; svgFile?: string }>;
}

export async function runRender(token: string, outDir: string): Promise<void> {
  const { owner, repo } = repoFromEnv();
  const event = readEventPayload<PullRequestEvent>();

  const client = new OctokitGithubClient(
    createOctokit(token) as unknown as ConstructorParameters<typeof OctokitGithubClient>[0],
  );

  const result = await renderPullRequestDiffs(client, {
    owner,
    repo,
    prNumber: event.pull_request.number,
    baseSha: event.pull_request.base.sha,
    headSha: event.pull_request.head.sha,
  });

  fs.mkdirSync(outDir, { recursive: true });

  const manifest: Manifest = {
    prNumber: event.pull_request.number,
    truncated: result.truncated,
    files: result.files.map((file, index) => {
      if (!file.svg) return { path: file.path, note: file.note, failed: file.failed };
      const svgFile = `${index}.svg`;
      fs.writeFileSync(path.join(outDir, svgFile), file.svg);
      return { path: file.path, svgFile };
    }),
  };

  fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`rendered ${manifest.files.length} tree(s) to ${outDir}`);
}
