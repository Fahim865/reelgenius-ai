import { describeError, readJson, type PublishInput, type PublishResult } from "./types.server";

const GRAPH = "https://graph.facebook.com/v21.0";

/** Facebook Page Reels: start -> upload (hosted file) -> finish. */
export async function publishToFacebook(input: PublishInput): Promise<PublishResult> {
  if (!input.externalId) throw describeError("Facebook", 400, "No Facebook Page is linked yet.");

  const start = await fetch(`${GRAPH}/${input.externalId}/video_reels`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${input.accessToken}` },
    body: JSON.stringify({ upload_phase: "start" }),
  });
  const startBody = await readJson(start);
  if (!start.ok) throw describeError("Facebook", start.status, startBody);

  const videoId = String((startBody as { video_id?: string }).video_id ?? "");
  const uploadUrl = String((startBody as { upload_url?: string }).upload_url ?? "");
  if (!videoId || !uploadUrl) throw describeError("Facebook", 500, startBody);

  const upload = await fetch(uploadUrl, {
    method: "POST",
    headers: { Authorization: `OAuth ${input.accessToken}`, file_url: input.fileUrl },
  });
  const uploadBody = await readJson(upload);
  if (!upload.ok) throw describeError("Facebook", upload.status, uploadBody);

  const finishUrl = new URL(`${GRAPH}/${input.externalId}/video_reels`);
  finishUrl.searchParams.set("upload_phase", "finish");
  finishUrl.searchParams.set("video_id", videoId);
  finishUrl.searchParams.set("video_state", "PUBLISHED");
  finishUrl.searchParams.set("description", `${input.title}\n\n${input.description}`.slice(0, 2000));

  const finish = await fetch(finishUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${input.accessToken}` },
  });
  const finishBody = await readJson(finish);
  if (!finish.ok) throw describeError("Facebook", finish.status, finishBody);

  return { remoteId: videoId, permalink: `https://www.facebook.com/reel/${videoId}` };
}

/** Instagram Reels via the Content Publishing API (Business/Creator accounts only). */
export async function publishToInstagram(input: PublishInput): Promise<PublishResult> {
  if (!input.externalId) throw describeError("Instagram", 400, "No Instagram Business account is linked yet.");

  const createUrl = new URL(`${GRAPH}/${input.externalId}/media`);
  createUrl.searchParams.set("media_type", "REELS");
  createUrl.searchParams.set("video_url", input.fileUrl);
  createUrl.searchParams.set("caption", `${input.title}\n\n${input.description}`.slice(0, 2200));
  createUrl.searchParams.set("share_to_feed", "true");

  const create = await fetch(createUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${input.accessToken}` },
  });
  const createBody = await readJson(create);
  if (!create.ok) throw describeError("Instagram", create.status, createBody);

  const containerId = String((createBody as { id?: string }).id ?? "");
  if (!containerId) throw describeError("Instagram", 500, createBody);

  // Instagram transcodes asynchronously; wait for the container to be ready.
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 4000));
    const status = await fetch(`${GRAPH}/${containerId}?fields=status_code,status`, {
      headers: { Authorization: `Bearer ${input.accessToken}` },
    });
    const statusBody = (await readJson(status)) as { status_code?: string; status?: string };
    if (statusBody.status_code === "FINISHED") break;
    if (statusBody.status_code === "ERROR") throw describeError("Instagram", 400, statusBody);
    if (attempt === 29) throw describeError("Instagram", 504, "Instagram is still processing the video. Try again shortly.");
  }

  const publishUrl = new URL(`${GRAPH}/${input.externalId}/media_publish`);
  publishUrl.searchParams.set("creation_id", containerId);
  const publish = await fetch(publishUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${input.accessToken}` },
  });
  const publishBody = await readJson(publish);
  if (!publish.ok) throw describeError("Instagram", publish.status, publishBody);

  const mediaId = String((publishBody as { id?: string }).id ?? "");
  return { remoteId: mediaId, permalink: mediaId ? `https://www.instagram.com/reel/${mediaId}` : null };
}
