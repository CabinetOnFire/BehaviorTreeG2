// Runs on `workflow_run`, which executes from the base repo with write access and
// secrets even when the PR came from a fork.
import * as fs from "fs";
import * as path from "path";
import { OctokitGithubClient } from "./github";
import { publishDiffComment, type RenderResult } from "./handler";
import { FileHouseImageHost } from "./imageHost";
import { createOctokit, readEventPayload, repoFromEnv } from "./octokit";
import type { Manifest } from "./render";

interface WorkflowRunEvent {
  workflow_run: { id: number; check_suite_node_id: string };
}

interface CheckSuiteQuery {
  repository: {
    pullRequest: {
      commits: { nodes: Array<{ commit: { checkSuites: { nodes: Array<{ id: string }> } } }> };
    } | null;
  };
}

/**
 * A fork controls the artifact contents, so it could name any PR it likes. Confirm the
 * PR's newest commit really belongs to the check suite that triggered us before trusting
 * the number — otherwise anyone could make us comment on an arbitrary PR.
 */
async function prBelongsToRun(
  octokit: { graphql: (query: string, params: Record<string, unknown>) => Promise<unknown> },
  owner: string,
  repo: string,
  prNumber: number,
  checkSuiteNodeId: string,
): Promise<boolean> {
  const result = (await octokit.graphql(
    `query($owner:String!, $repo:String!, $prNumber:Int!) {
      repository(owner: $owner, name: $repo) {
        pullRequest(number: $prNumber) {
          commits(last: 1) {
            nodes { commit { checkSuites(first: 10) { nodes { id } } } }
          }
        }
      }
    }`,
    { owner, repo, prNumber },
  )) as CheckSuiteQuery;

  const commit = result.repository.pullRequest?.commits.nodes[0]?.commit;
  return commit?.checkSuites.nodes.some(({ id }) => id === checkSuiteNodeId) ?? false;
}

/** Reads a rendered artifact directory back into the shape publishDiffComment wants. */
export function loadRenderResult(
  inDir: string,
): { manifest: Manifest; result: RenderResult } | null {
  const manifestPath = path.join(inDir, "manifest.json");
  if (!fs.existsSync(manifestPath)) return null;

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as Manifest;
  return {
    manifest,
    result: {
      truncated: manifest.truncated,
      files: manifest.files.map((file) => ({
        path: file.path,
        note: file.note,
        failed: file.failed,
        svg: file.svgFile ? fs.readFileSync(path.join(inDir, file.svgFile), "utf8") : undefined,
      })),
    },
  };
}

export async function runPublish(
  token: string,
  fileHouseKey: string,
  inDir: string,
): Promise<void> {
  const { owner, repo } = repoFromEnv();
  const event = readEventPayload<WorkflowRunEvent>();

  const loaded = loadRenderResult(inDir);
  if (!loaded) {
    console.log("no manifest in artifact, nothing to publish");
    return;
  }
  const { manifest, result } = loaded;

  const octokit = createOctokit(token);
  const valid = await prBelongsToRun(
    octokit as unknown as Parameters<typeof prBelongsToRun>[0],
    owner,
    repo,
    manifest.prNumber,
    event.workflow_run.check_suite_node_id,
  );
  if (!valid) {
    console.error(
      `PR #${manifest.prNumber} does not belong to check suite ${event.workflow_run.check_suite_node_id}, refusing to comment`,
    );
    process.exit(1);
  }

  const client = new OctokitGithubClient(
    octokit as unknown as ConstructorParameters<typeof OctokitGithubClient>[0],
  );
  await publishDiffComment(
    client,
    new FileHouseImageHost(fileHouseKey),
    { owner, repo, prNumber: manifest.prNumber },
    result,
  );
  console.log(`published diff comment on #${manifest.prNumber}`);
}
