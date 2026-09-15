export type PublishInput = {
  fileUrl: string;
  title: string;
  description: string;
  accessToken: string;
  externalId: string | null;
};

export type PublishResult = {
  remoteId: string;
  permalink: string | null;
};

export class PublishError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function readJson(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { raw: text } as Record<string, unknown>;
  }
}

export function describeError(platform: string, status: number, body: unknown) {
  const message =
    typeof body === "object" && body !== null
      ? ((body as { error?: { message?: string } }).error?.message ??
        (body as { error_description?: string }).error_description ??
        JSON.stringify(body).slice(0, 400))
      : String(body).slice(0, 400);
  return new PublishError(status, `${platform} rejected the upload [${status}]: ${message}`);
}
