import { diffBtJsonTexts, TreeTooLargeError } from "../diff/pipeline";
import type { GithubClient } from "./github";
import type { ImageHost } from "./imageHost";

export const MAX_FILES = 25; // unless ur john behavior tree this should be enough

/** Hidden marker identifying our own comments, so we can clear stale ones on re-runs. */
export const COMMENT_MARKER = "<!-- behaviortreediffbot -->";

export interface PullRequestRef {
  owner: string;
  repo: string;
  prNumber: number;
  baseSha: string;
  headSha: string;
}

/** One file's outcome: either a rendered SVG, or a note explaining why there isn't one. */
export interface RenderedDiff {
  path: string;
  svg?: string;
  note?: string;
  failed?: boolean;
}

export interface RenderResult {
  files: RenderedDiff[];
  /** How many changed trees were dropped by the MAX_FILES cap. */
  truncated: number;
}

async function renderOne(
  client: GithubClient,
  ref: PullRequestRef,
  file: { path: string; status: string },
): Promise<RenderedDiff> {
  const oldText =
    file.status === "added" ? null : await client.fetchFileAtRef(ref.owner, ref.repo, file.path, ref.baseSha);
  const newText =
    file.status === "removed" ? null : await client.fetchFileAtRef(ref.owner, ref.repo, file.path, ref.headSha);

  if (oldText === null && newText === null) {
    return { path: file.path, note: "could not read this file on either side" };
  }

  try {
    return { path: file.path, svg: diffBtJsonTexts(oldText, newText) };
  } catch (err) {
    if (err instanceof TreeTooLargeError) {
      return { path: file.path, note: `tree too large to render (${err.count} nodes, limit ${err.max})` };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { path: file.path, note: `failed to render: ${message}`, failed: true };
  }
}

/**
 * Render every changed .bt.json in the PR. Needs only read access, so it is safe to run
 * in a job holding the read-only token a fork PR gets.
 */
export async function renderPullRequestDiffs(client: GithubClient, ref: PullRequestRef): Promise<RenderResult> {
  const files = await client.listChangedBtJsonFiles(ref.owner, ref.repo, ref.prNumber);
  const rendered: RenderedDiff[] = [];

  for (const file of files.slice(0, MAX_FILES)) {
    rendered.push(await renderOne(client, ref, file));
  }

  return { files: rendered, truncated: Math.max(0, files.length - MAX_FILES) };
}

function buildCommentBody(sections: string[], truncated: number): string {
  const parts = [COMMENT_MARKER, "## Behavior tree diff", ...sections];
  if (truncated > 0) parts.push(`${truncated} more changed tree(s) not shown.`);
  return parts.join("\n\n");
}

/**
 * Upload the rendered diffs and leave exactly one comment on the PR, clearing any we
 * left on earlier runs. Requires write access and the upload key.
 */
export async function publishDiffComment(
  client: GithubClient,
  host: ImageHost,
  ref: Pick<PullRequestRef, "owner" | "repo" | "prNumber">,
  result: RenderResult,
): Promise<void> {
  const stale = (await client.listIssueComments(ref.owner, ref.repo, ref.prNumber)).filter((c) =>
    c.body.includes(COMMENT_MARKER),
  );

  // A PR that no longer touches any tree should end up with no comment at all, not a
  // stale one describing trees it used to touch.
  if (result.files.length > 0) {
    const sections: string[] = [];
    for (const file of result.files) {
      if (file.svg) {
        const url = await host.upload(`${file.path.replace(/[^\w.-]/g, "_")}.svg`, Buffer.from(file.svg), "image/svg+xml");
        sections.push(`### \`${file.path}\`\n![diff](${url})`);
      } else {
        sections.push(`### \`${file.path}\`\n${file.note}`);
      }
    }
    await client.createIssueComment(ref.owner, ref.repo, ref.prNumber, buildCommentBody(sections, result.truncated));
  }

  for (const comment of stale) {
    await client.deleteIssueComment(ref.owner, ref.repo, comment.id);
  }
}
