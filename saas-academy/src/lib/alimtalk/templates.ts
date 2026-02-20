/**
 * src/lib/alimtalk/templates.ts
 *
 * Template variable builder for attendance-triggered AlimTalk messages.
 *
 * Kakao template variables use #{varName} syntax.
 * This module normalises the variable map expected by our templates.
 *
 * Standard variables (register matching #{...} in Kakao BizMessage portal):
 *   #{academyName}   – 학원 이름
 *   #{studentName}   – 학생 이름
 *   #{className}     – 수업 이름
 *   #{sessionDate}   – 수업 날짜  (YYYY-MM-DD)
 *   #{sessionTime}   – 수업 시간  (HH:mm)
 *   #{statusText}    – 출결 상태  (예: 결석, 지각)
 *   #{teacherName}   – 선생님 이름
 */

export interface AttendanceTemplateVars {
  academyName:  string;
  studentName:  string;
  className:    string;
  sessionDate:  string; // YYYY-MM-DD
  sessionTime:  string; // HH:mm
  statusText:   string;
  teacherName:  string;
}

/** Human-readable Korean label for each attendance status */
export const STATUS_LABEL: Record<string, string> = {
  ABSENT:  "결석",
  LATE:    "지각",
  EXCUSED: "공결",
  PRESENT: "출석",
};

/**
 * Build the template variable map for Kakao from typed inputs.
 * Returns Record<string, string> ready to JSON-stringify into tpl_vars.
 */
export function buildAttendanceVars(
  vars: AttendanceTemplateVars,
): Record<string, string> {
  return {
    academyName: vars.academyName,
    studentName: vars.studentName,
    className:   vars.className,
    sessionDate: vars.sessionDate,
    sessionTime: vars.sessionTime,
    statusText:  vars.statusText,
    teacherName: vars.teacherName,
  };
}

/**
 * Format a UTC DateTime as KST date string "YYYY-MM-DD".
 */
export function toKSTDateString(utcDate: Date): string {
  return utcDate.toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul",
    year:     "numeric",
    month:    "2-digit",
    day:      "2-digit",
  }).replace(/\. /g, "-").replace(".", "");
}

/**
 * Format a UTC DateTime as KST time string "HH:mm".
 */
export function toKSTTimeString(utcDate: Date): string {
  return utcDate.toLocaleTimeString("ko-KR", {
    timeZone: "Asia/Seoul",
    hour:     "2-digit",
    minute:   "2-digit",
    hour12:   false,
  });
}
