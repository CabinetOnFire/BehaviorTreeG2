import * as fs from "fs";
import { Octokit } from "@octokit/core";
import { restEndpointMethods } from "@octokit/plugin-rest-endpoint-methods";
import { paginateRest } from "@octokit/plugin-paginate-rest";

// rest.* and paginate() come from these plugins, which OctokitGithubClient depends on.
export const ActionOctokit = Octokit.plugin(restEndpointMethods, paginateRest);

export function createOctokit(token: string): InstanceType<typeof ActionOctokit> {
  return new ActionOctokit({ auth: token });
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`${name} is required`);
    process.exit(1);
  }
  return value;
}

/** Splits GITHUB_REPOSITORY ("owner/repo") into its parts. */
export function repoFromEnv(): { owner: string; repo: string } {
  const [owner, repo] = requireEnv("GITHUB_REPOSITORY").split("/");
  return { owner, repo };
}

export function readEventPayload<T>(): T {
  return JSON.parse(fs.readFileSync(requireEnv("GITHUB_EVENT_PATH"), "utf8")) as T;
}
