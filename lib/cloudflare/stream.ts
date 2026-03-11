const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID!;
const CLOUDFLARE_STREAM_API_TOKEN = process.env.CLOUDFLARE_STREAM_API_TOKEN!;

const baseUrl = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream`;

const headers = {
  Authorization: `Bearer ${CLOUDFLARE_STREAM_API_TOKEN}`,
  "Content-Type": "application/json",
};

export async function getVideoDetails(videoId: string) {
  const res = await fetch(`${baseUrl}/${videoId}`, { headers });
  if (!res.ok) throw new Error(`Cloudflare Stream error: ${res.statusText}`);
  const json = await res.json();
  return json.result;
}

export async function getSignedUrl(videoId: string): Promise<string> {
  const res = await fetch(`${baseUrl}/${videoId}/token`, {
    method: "POST",
    headers,
  });
  if (!res.ok) throw new Error(`Cloudflare Stream token error: ${res.statusText}`);
  const json = await res.json();
  return json.result.token;
}
