interface SMSAdapter {
  sendMessage(
    to: string,
    body: string
  ): Promise<{ success: boolean; error?: string }>;
}

class StubAdapter implements SMSAdapter {
  async sendMessage(to: string, body: string) {
    console.log(`[SMS:stub] Would send to ${to}: ${body}`);
    return { success: true };
  }
}

export async function getSMSAdapter(tenantId: string): Promise<SMSAdapter> {
  // Check for Quo API key
  const quoKey = process.env.QUO_API_KEY;
  if (quoKey) {
    const { QuoAdapter } = await import("./quo");
    return new QuoAdapter(quoKey);
  }

  return new StubAdapter();
}

export type { SMSAdapter };
