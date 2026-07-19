/**
 * Where rendered diffs get parked so GitHub can embed them.
 */
export interface ImageHost {
  upload(filename: string, data: Uint8Array, contentType: string): Promise<string>;
}

/** Uploads to file.house, take my image, orange! */
export class FileHouseImageHost implements ImageHost {
  constructor(
    private readonly apiKey: string,
    private readonly endpoint = "https://file.house/api/upload",
  ) {}

  async upload(filename: string, data: Uint8Array, contentType: string): Promise<string> {
    const form = new FormData();
    form.set("key", this.apiKey);
    form.set("file", new Blob([new Uint8Array(data)], { type: contentType }), filename);

    const response = await fetch(this.endpoint, { method: "POST", body: form });
    if (!response.ok) {
      throw new Error(`upload of ${filename} failed: ${response.status} ${await response.text()}`);
    }

    const body = (await response.json()) as { url?: unknown };
    if (typeof body.url !== "string") {
      throw new Error(`upload of ${filename} returned no url: ${JSON.stringify(body)}`);
    }
    return body.url;
  }
}
