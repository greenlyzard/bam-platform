const KLAVIYO_API_KEY = process.env.KLAVIYO_API_KEY!;
const BASE_URL = "https://a.klaviyo.com/api";

const headers = {
  Authorization: `Klaviyo-API-Key ${KLAVIYO_API_KEY}`,
  "Content-Type": "application/json",
  revision: "2024-10-15",
};

export async function addProfileToList(listId: string, email: string, properties?: Record<string, unknown>) {
  const res = await fetch(`${BASE_URL}/lists/${listId}/relationships/profiles/`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      data: [
        {
          type: "profile",
          attributes: { email, properties },
        },
      ],
    }),
  });

  if (!res.ok) {
    console.error("[klaviyo:addToList]", await res.text());
    throw new Error("Failed to add profile to Klaviyo list");
  }
}
