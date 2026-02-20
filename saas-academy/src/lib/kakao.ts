/**
 * src/lib/kakao.ts
 *
 * KakaoTalk Biz Message (AlimTalk) HTTP client.
 *
 * Docs: https://business.kakao.com/info/bizmessage/
 * The API follows the "KakaoTalk Channel / AlimTalk" REST spec.
 *
 * Set KAKAO_API_KEY, KAKAO_SENDER_KEY in your .env file.
 * Template codes are set per notification type (KAKAO_TEMPLATE_CODE_*).
 */

export interface KakaoMessageParams {
  /** Template code registered in Kakao BizMessage portal */
  templateCode: string;
  /** Recipient phone number (E.164 format, e.g. "01012345678") */
  phone: string;
  /** Key→value pairs matching template variables, e.g. { name: "홍길동" } */
  variables: Record<string, string>;
}

export interface KakaoSendResult {
  success: boolean;
  msgKey?: string;        // Kakao message key on success
  error?: string;
}

const KAKAO_API_BASE = "https://kakaoapi.aligo.in";

/**
 * Send a single AlimTalk message.
 * Returns { success, msgKey } or { success: false, error }.
 */
export async function sendKakaoAlimTalk(
  params: KakaoMessageParams,
): Promise<KakaoSendResult> {
  const apiKey    = process.env.KAKAO_API_KEY;
  const senderKey = process.env.KAKAO_SENDER_KEY;

  if (!apiKey || !senderKey) {
    console.warn("[Kakao] KAKAO_API_KEY or KAKAO_SENDER_KEY not configured – skipping send");
    return { success: false, error: "Kakao credentials not configured" };
  }

  // Build template message by substituting #{variable} placeholders
  // (actual substitution handled server-side by Kakao from tpl_vars)
  const body = new URLSearchParams({
    apikey:      apiKey,
    userid:      senderKey,
    senderkey:   senderKey,
    tpl_code:    params.templateCode,
    receiver_1:  params.phone,
    // Serialise template variables as JSON string per Kakao spec
    tpl_vars:    JSON.stringify(params.variables),
    // Fallback SMS (0 = AlimTalk only, 1 = SMS fallback)
    failover:    "0",
  });

  try {
    const res = await fetch(`${KAKAO_API_BASE}/akv10/alimtalk/send/`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: AbortSignal.timeout(10_000), // 10 s timeout
    });

    if (!res.ok) {
      return { success: false, error: `HTTP ${res.status}` };
    }

    const data = (await res.json()) as {
      code: number;
      message: string;
      info?: { mid: string };
    };

    if (data.code !== 0) {
      return { success: false, error: `${data.code}: ${data.message}` };
    }

    return { success: true, msgKey: data.info?.mid };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}
