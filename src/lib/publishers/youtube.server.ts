import { describeError, readJson, type PublishInput, type PublishResult } from "./types.server";

/** Uploads a rendered 9:16 reel to YouTube as a Short (must be <= 60s and vertical). */
export async function publishToYouTube(input: PublishInput): Promise<PublishResult> {
  const file = await fetch(input.fileUrl);
  if (!file.ok || !file.body) {
    throw describeError("YouTube", file.status, "Could not read the rendered video from storage.");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());

  const init = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": "application/json",
        "X-Upload-Content-Type": "video/mp4",
        "X-Upload-Content-Length": String(bytes.byteLength),
      },
      body: JSON.stringify({
        snippet: {
          title: input.title.slice(0, 95),
          description: `${input.description}\n\n#Shorts`.slice(0, 4900),
          categoryId: "22",
        },
        status: { privacyStatus: "public", selfDeclaredMadeForKids: false },
      }),
    },
  );

  if (!init.ok) throw describeError("YouTube", init.status, await readJson(init));
  const uploadUrl = init.headers.get("location");
  if (!uploadUrl) throw describeError("YouTube", 500, "YouTube did not return an upload URL.");

  const upload = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "video/mp4", "Content-Length": String(bytes.byteLength) },
    body: bytes,
  });

  const body = await readJson(upload);
  if (!upload.ok) throw describeError("YouTube", upload.status, body);

  const id = String((body as { id?: string }).id ?? "");
  if (!id) throw describeError("YouTube", 500, body);

  return { remoteId: id, permalink: `https://www.youtube.com/shorts/${id}` };
}
