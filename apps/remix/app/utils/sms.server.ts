// Send an SMS via Twilio's REST API (no SDK needed). Env-gated: if Twilio
// credentials aren't set, it returns a clear "not configured" result instead of
// throwing, so the rest of the app keeps working until the keys are added.
//
// Required Railway env vars:
//   NEXT_PRIVATE_TWILIO_ACCOUNT_SID  — from the Twilio console
//   NEXT_PRIVATE_TWILIO_AUTH_TOKEN   — from the Twilio console
//   NEXT_PRIVATE_TWILIO_FROM         — your Twilio phone number, e.g. +13025551234

export type SendSmsResult = { ok: true } | { ok: false; error: string };

export function isSmsConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PRIVATE_TWILIO_ACCOUNT_SID &&
      process.env.NEXT_PRIVATE_TWILIO_AUTH_TOKEN &&
      process.env.NEXT_PRIVATE_TWILIO_FROM,
  );
}

export async function sendSms({ to, body }: { to: string; body: string }): Promise<SendSmsResult> {
  const sid = process.env.NEXT_PRIVATE_TWILIO_ACCOUNT_SID;
  const token = process.env.NEXT_PRIVATE_TWILIO_AUTH_TOKEN;
  const from = process.env.NEXT_PRIVATE_TWILIO_FROM;

  if (!sid || !token || !from) {
    return { ok: false, error: 'Texting is not set up yet (Twilio credentials missing).' };
  }

  if (!to.trim()) {
    return { ok: false, error: 'A phone number is required.' };
  }

  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: to.trim(), From: from, Body: body }).toString(),
    });

    if (!res.ok) {
      const detail = await res.text();
      return { ok: false, error: `Twilio error ${res.status}: ${detail.slice(0, 200)}` };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to send text.' };
  }
}
