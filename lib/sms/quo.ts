import type { SMSAdapter } from "./adapter";

export class QuoAdapter implements SMSAdapter {
  private apiKey: string;
  private baseUrl = "https://api.openphone.com/v1";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async sendMessage(to: string, body: string) {
    try {
      const phoneNumberId = process.env.QUO_PHONE_NUMBER_ID;
      if (!phoneNumberId)
        return { success: false, error: "QUO_PHONE_NUMBER_ID not configured" };

      const res = await fetch(`${this.baseUrl}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: this.apiKey,
        },
        body: JSON.stringify({ phoneNumberId, to, content: body }),
      });

      if (!res.ok) {
        const err = await res.text();
        console.error("[SMS:quo] Send failed:", err);
        return { success: false, error: err };
      }

      return { success: true };
    } catch (e) {
      console.error("[SMS:quo] Error:", e);
      return { success: false, error: String(e) };
    }
  }

  async getMessages(phoneNumberId: string, limit = 50) {
    try {
      const res = await fetch(
        `${this.baseUrl}/messages?phoneNumberId=${phoneNumberId}&maxResults=${limit}`,
        {
          headers: { Authorization: this.apiKey },
        }
      );
      if (!res.ok) return [];
      const data = await res.json();
      return data.data ?? [];
    } catch {
      return [];
    }
  }
}
