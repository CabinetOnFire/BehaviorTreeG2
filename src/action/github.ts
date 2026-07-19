export interface ChangedFile {
  path: string;
  status: "added" | "removed" | "modified" | "renamed" | "copied" | "changed" | "unchanged";
}

export interface IssueComment {
  id: number;
  body: string;
}

export interface GithubClient {
  listChangedBtJsonFiles(owner: string, repo: string, prNumber: number): Promise<ChangedFile[]>;
  fetchFileAtRef(owner: string, repo: string, filePath: string, ref: string): Promise<string | null>;
  listIssueComments(owner: string, repo: string, issueNumber: number): Promise<IssueComment[]>;
  createIssueComment(owner: string, repo: string, issueNumber: number, body: string): Promise<void>;
  deleteIssueComment(owner: string, repo: string, commentId: number): Promise<void>;
}

interface OctokitLike {
  paginate<T>(method: unknown, params: Record<string, unknown>): Promise<T[]>;
  rest: {
    pulls: {
      listFiles: unknown;
    };
    issues: {
      listComments: unknown;
      createComment(params: {
        owner: string;
        repo: string;
        issue_number: number;
        body: string;
      }): Promise<unknown>;
      deleteComment(params: { owner: string; repo: string; comment_id: number }): Promise<unknown>;
    };
    repos: {
      getContent(params: {
        owner: string;
        repo: string;
        path: string;
        ref: string;
      }): Promise<{ data: unknown }>;
    };
  };
}

/** Real GithubClient backed by an authenticated Octokit instance. */
export class OctokitGithubClient implements GithubClient {
  constructor(private readonly octokit: OctokitLike) {}

  async listChangedBtJsonFiles(owner: string, repo: string, prNumber: number): Promise<ChangedFile[]> {
    const files = await this.octokit.paginate<{ filename: string; status: string }>(
      this.octokit.rest.pulls.listFiles,
      { owner, repo, pull_number: prNumber, per_page: 100 },
    );
    return files
      .filter((f) => f.filename.endsWith(".bt.json"))
      .map((f) => ({ path: f.filename, status: f.status as ChangedFile["status"] }));
  }

  async fetchFileAtRef(owner: string, repo: string, filePath: string, ref: string): Promise<string | null> {
    let data: unknown;
    try {
      ({ data } = await this.octokit.rest.repos.getContent({ owner, repo, path: filePath, ref }));
    } catch (err) {
      if ((err as { status?: number }).status === 404) return null;
      throw err;
    }
    if (!data || typeof data !== "object" || !("content" in data) || (data as { type?: string }).type !== "file") {
      throw new Error(`${filePath}@${ref} did not resolve to a single file`);
    }
    return Buffer.from((data as { content: string }).content, "base64").toString("utf8");
  }

  async listIssueComments(owner: string, repo: string, issueNumber: number): Promise<IssueComment[]> {
    const comments = await this.octokit.paginate<{ id: number; body?: string }>(
      this.octokit.rest.issues.listComments,
      { owner, repo, issue_number: issueNumber, per_page: 100 },
    );
    return comments.map((c) => ({ id: c.id, body: c.body ?? "" }));
  }

  async createIssueComment(owner: string, repo: string, issueNumber: number, body: string): Promise<void> {
    await this.octokit.rest.issues.createComment({ owner, repo, issue_number: issueNumber, body });
  }

  async deleteIssueComment(owner: string, repo: string, commentId: number): Promise<void> {
    await this.octokit.rest.issues.deleteComment({ owner, repo, comment_id: commentId });
  }
}
