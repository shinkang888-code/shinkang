/**
 * 카카오 메시지 서비스
 *
 * 연동 흐름:
 * 1. 학원 원생이 카카오 OAuth 로그인 → access_token + talk_message 동의 획득
 * 2. KakaoLink 테이블에 토큰 저장
 * 3. 메시지 발송 시 저장된 access_token 사용
 * 4. 토큰 만료 시 refresh_token으로 갱신
 *
 * 참고 API:
 * - 나에게 보내기: POST https://kapi.kakao.com/v2/api/talk/memo/default/send
 * - 카카오톡 채널 메시지: POST https://kapi.kakao.com/v1/api/talk/channels/{channel_public_id}/message
 */

import { prisma } from "@/lib/prisma";
import { NotificationType } from "@/types";

const KAKAO_TOKEN_URL = "https://kauth.kakao.com/oauth/token";
const KAKAO_MESSAGE_URL = "https://kapi.kakao.com/v2/api/talk/memo/default/send";

interface KakaoMessageTemplate {
  object_type: "text";
  text: string;
  link: {
    web_url?: string;
    mobile_web_url?: string;
  };
  button_title?: string;
}

/**
 * 카카오 액세스 토큰 갱신
 */
async function refreshKakaoToken(
  userId: string,
  refreshToken: string
): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: process.env.KAKAO_CLIENT_ID ?? "",
      client_secret: process.env.KAKAO_CLIENT_SECRET ?? "",
      refresh_token: refreshToken,
    });

    const res = await fetch(KAKAO_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const newAccessToken: string = data.access_token;
    const newRefreshToken: string | undefined = data.refresh_token;
    const expiresIn: number = data.expires_in ?? 21600;

    await prisma.kakaoLink.update({
      where: { userId },
      data: {
        accessToken: newAccessToken,
        ...(newRefreshToken && { refreshToken: newRefreshToken }),
        tokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
      },
    });

    return newAccessToken;
  } catch {
    return null;
  }
}

/**
 * 유효한 액세스 토큰 가져오기 (만료 시 갱신)
 */
async function getValidAccessToken(userId: string): Promise<string | null> {
  const link = await prisma.kakaoLink.findUnique({ where: { userId } });
  if (!link) return null;

  // talk_message 동의 확인
  if (!link.scopes.includes("talk_message")) return null;

  // 토큰 만료 여부 (5분 여유)
  const isExpired = link.tokenExpiresAt < new Date(Date.now() + 5 * 60 * 1000);
  if (isExpired) {
    return await refreshKakaoToken(userId, link.refreshToken);
  }

  return link.accessToken;
}

/**
 * 카카오 메시지 발송 (나에게 보내기)
 */
async function sendKakaoMessage(
  accessToken: string,
  template: KakaoMessageTemplate
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(KAKAO_MESSAGE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `template_object=${encodeURIComponent(JSON.stringify(template))}`,
    });

    if (!res.ok) {
      const err = await res.json();
      return { ok: false, error: err.msg ?? "카카오 메시지 발송 실패" };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/**
 * 납부 예정 알림 발송
 */
export async function sendPaymentDueNotification(
  studentId: string,
  paymentId: string,
  studentName: string,
  amount: number,
  dueDate: Date
) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { user: true },
  });
  if (!student) return;

  const notification = await prisma.kakaoNotification.create({
    data: {
      studentId,
      paymentId,
      type: "PAYMENT_DUE",
      status: "PENDING",
      message: `[납부 예정 안내] ${studentName}님의 수강료 ${amount.toLocaleString()}원이 ${dueDate.toLocaleDateString("ko-KR")}에 납부 예정입니다.`,
    },
  });

  const accessToken = await getValidAccessToken(student.userId);
  if (!accessToken) {
    await prisma.kakaoNotification.update({
      where: { id: notification.id },
      data: { status: "SKIPPED", errorMsg: "카카오 미연동 또는 동의 없음" },
    });
    return;
  }

  const template: KakaoMessageTemplate = {
    object_type: "text",
    text: notification.message,
    link: {
      web_url: `${process.env.NEXT_PUBLIC_APP_URL}/student/payments`,
      mobile_web_url: `${process.env.NEXT_PUBLIC_APP_URL}/student/payments`,
    },
    button_title: "납부 내역 확인",
  };

  const result = await sendKakaoMessage(accessToken, template);
  await prisma.kakaoNotification.update({
    where: { id: notification.id },
    data: {
      status: result.ok ? "SENT" : "FAILED",
      sentAt: result.ok ? new Date() : undefined,
      errorMsg: result.error,
    },
  });
}

/**
 * 미납 알림 발송
 */
export async function sendPaymentOverdueNotification(
  studentId: string,
  paymentId: string,
  studentName: string,
  amount: number,
  overdueDays: number
) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { user: true },
  });
  if (!student) return;

  const message = `[미납 안내] ${studentName}님의 수강료 ${amount.toLocaleString()}원이 ${overdueDays}일 연체 중입니다. 빠른 납부 부탁드립니다.`;
  const notification = await prisma.kakaoNotification.create({
    data: { studentId, paymentId, type: "PAYMENT_OVERDUE", status: "PENDING", message },
  });

  const accessToken = await getValidAccessToken(student.userId);
  if (!accessToken) {
    await prisma.kakaoNotification.update({
      where: { id: notification.id },
      data: { status: "SKIPPED", errorMsg: "카카오 미연동 또는 동의 없음" },
    });
    return;
  }

  const template: KakaoMessageTemplate = {
    object_type: "text",
    text: message,
    link: {
      web_url: `${process.env.NEXT_PUBLIC_APP_URL}/student/payments`,
      mobile_web_url: `${process.env.NEXT_PUBLIC_APP_URL}/student/payments`,
    },
    button_title: "납부 내역 확인",
  };

  const result = await sendKakaoMessage(accessToken, template);
  await prisma.kakaoNotification.update({
    where: { id: notification.id },
    data: {
      status: result.ok ? "SENT" : "FAILED",
      sentAt: result.ok ? new Date() : undefined,
      errorMsg: result.error,
    },
  });
}

/**
 * 레슨 리마인드 알림 발송
 */
export async function sendLessonReminderNotification(
  studentId: string,
  studentName: string,
  lessonTitle: string,
  startAt: Date
) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { user: true },
  });
  if (!student) return;

  const timeStr = startAt.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const dateStr = startAt.toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });

  const message = `[레슨 알림] ${studentName}님, 내일 ${dateStr} ${timeStr}에 ${lessonTitle} 레슨이 예정되어 있습니다.`;
  const notification = await prisma.kakaoNotification.create({
    data: { studentId, type: "LESSON_REMINDER", status: "PENDING", message },
  });

  const accessToken = await getValidAccessToken(student.userId);
  if (!accessToken) {
    await prisma.kakaoNotification.update({
      where: { id: notification.id },
      data: { status: "SKIPPED", errorMsg: "카카오 미연동 또는 동의 없음" },
    });
    return;
  }

  const template: KakaoMessageTemplate = {
    object_type: "text",
    text: message,
    link: {
      web_url: `${process.env.NEXT_PUBLIC_APP_URL}/student/schedule`,
      mobile_web_url: `${process.env.NEXT_PUBLIC_APP_URL}/student/schedule`,
    },
    button_title: "일정 확인",
  };

  const result = await sendKakaoMessage(accessToken, template);
  await prisma.kakaoNotification.update({
    where: { id: notification.id },
    data: {
      status: result.ok ? "SENT" : "FAILED",
      sentAt: result.ok ? new Date() : undefined,
      errorMsg: result.error,
    },
  });
}
