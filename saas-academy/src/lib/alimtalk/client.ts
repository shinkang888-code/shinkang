/**
 * src/lib/alimtalk/client.ts
 *
 * Low-level Kakao AlimTalk HTTP client.
 *
 * Provider: Aligo BizMessage REST API (https://kakaoapi.aligo.in)
 *   POST /akv10/alimtalk/send/
 *
 * Environment variables required:
 *   KAKAO_API_KEY     – Aligo API key (issued per service account)
 *   KAKAO_USER_ID     – Aligo user ID (same as API key issuing account)
 *
 * Per-template:
 *   senderKey    – Kakao channel sender key (stored in AlimtalkTemplate row)
 *   templateCode – registered template code  (stored in AlimtalkTemplate row)
 */

export interface AlimtalkSendParams {
  senderKey:    string;
  templateCode: string;
  /** Recipient phone: 01012345678 (no dashes/spaces, no +82) */
  phone:        string;
  /** Template variable substitutions, e.g. { studentName: "홍길동" } */
  variables:    Record<string, string>;
}

export interface AlimtalkSendResult {
  success:   boolean;
  msgKey?:   string;   // Kakao message key returned on success
  errorCode?: string;
  errorMessage?: string;
}

const BASE_URL = "https://kakaoapi.aligo.in";

/**
 * Send one AlimTalk message.
 * Safe to call server-side only; never call from client components.
 */
export async function sendAlimtalk(
  params: AlimtalkSendParams,
): Promise<AlimtalkSendResult> {
  const apiKey = process.env.KAKAO_API_KEY;
  const userId = process.env.KAKAO_USER_ID;

  if (!apiKey || !userId) {
    console.warn(
      "[AlimTalk] KAKAO_API_KEY or KAKAO_USER_ID not set – message not sent",
    );
    return {
      success: false,
      errorCode: "CONFIG_MISSING",
      errorMessage: "Kakao credentials not configured",
    };
  }

  const body = new URLSearchParams({
    apikey:     apiKey,
    userid:     userId,
    senderkey:  params.senderKey,
    tpl_code:   params.templateCode,
    receiver_1: params.phone,
    // Kakao substitutes #{varName} in the template using this JSON map
    tpl_vars:   JSON.stringify(params.variables),
    failover:   "0", // 0 = AlimTalk only, no SMS fallback
  });

  try {
    const res = await fetch(`${BASE_URL}/akv10/alimtalk/send/`, {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    body.toString(),
      signal:  AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      return {
        success:      false,
        errorCode:    `HTTP_${res.status}`,
        errorMessage: `HTTP error ${res.status}`,
      };
    }

    const data = (await res.json()) as {
      code:    number;
      message: string;
      info?:   { mid?: string };
    };

    if (data.code !== 0) {
      return {
        success:      false,
        errorCode:    String(data.code),
        errorMessage: data.message,
      };
    }

    return { success: true, msgKey: data.info?.mid };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, errorCode: "FETCH_ERROR", errorMessage: msg };
  }
}
