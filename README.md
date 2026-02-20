# 🎹 피아노 학원 관리 시스템 (Piano Academy Manager)

학원 운영자와 원생을 위한 풀스택 웹앱 MVP입니다.

## 🚀 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | Next.js 16 (App Router) + TypeScript + Tailwind CSS |
| UI 컴포넌트 | shadcn/ui |
| Backend | Next.js Route Handlers (Server API) |
| ORM | Prisma v7 (pg 어댑터) |
| DB | PostgreSQL |
| 인증 | NextAuth v5 (Credentials + Kakao OAuth) |
| 달력 | FullCalendar v6 |
| 테스트 | Vitest |
| 배포 | Vercel (DB: Supabase / Neon) |

---

## 📁 폴더 구조

```
src/
├── app/
│   ├── (auth)/              # 로그인/회원가입 레이아웃
│   │   ├── login/           # 로그인 페이지
│   │   └── register/        # 학원 등록 페이지
│   ├── (dashboard)/         # 인증 후 레이아웃 (사이드바)
│   │   ├── admin/
│   │   │   ├── dashboard/   # 관리자 대시보드
│   │   │   ├── students/    # 원생 관리
│   │   │   ├── schedule/    # 레슨 일정 (FullCalendar)
│   │   │   ├── payments/    # 수강료 관리
│   │   │   └── notifications/ # 카카오톡 알림 발송
│   │   └── student/
│   │       ├── dashboard/   # 원생 대시보드 + 연습 타이머
│   │       ├── schedule/    # 내 레슨 일정
│   │       ├── practice/    # 연습 세션 기록
│   │       └── payments/    # 납부 내역
│   └── api/
│       ├── auth/            # NextAuth + 회원가입
│       ├── admin/           # 관리자 API (students, lessons, schedules, payments, notifications)
│       └── student/         # 원생 API (schedule, payments, practice, stats)
├── components/
│   ├── admin/               # AdminDashboardClient, StudentsClient, PaymentsClient, NotificationsClient
│   ├── student/             # StudentDashboardClient, PracticeClient, StudentPaymentsClient
│   ├── calendar/            # AdminCalendar, StudentCalendar, FullCalendarWrapper
│   ├── layout/              # Sidebar
│   └── ui/                  # shadcn/ui 컴포넌트
├── lib/
│   ├── prisma.ts            # Prisma Client (pg 어댑터)
│   ├── auth.ts              # NextAuth 설정
│   └── api-helpers.ts       # 인증/권한 헬퍼
├── services/
│   └── kakao.ts             # 카카오톡 메시지 서비스
├── types/
│   ├── index.ts             # 도메인 타입
│   └── next-auth.d.ts       # NextAuth 타입 확장
└── middleware.ts            # 라우트 보호 (Edge 호환)
```

---

## 🗂 ERD 요약

```
User (1) ──── (1) Student
User (1) ──── (*) Account (OAuth)
User (1) ──── (1) KakaoLink

Studio (*) ──── (1) User [adminId]
Studio (1) ──── (*) Student
Studio (1) ──── (*) Lesson
Studio (1) ──── (*) Notice

Student (1) ──── (*) LessonSchedule
Student (1) ──── (*) Payment
Student (1) ──── (*) PracticeSession
Student (1) ──── (*) KakaoNotification

Lesson (1) ──── (*) LessonSchedule
Payment (1) ──── (*) KakaoNotification
```

---

## 🌐 주요 API 라우트

### 관리자 API
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/admin/dashboard?studioId` | 대시보드 통계 |
| GET | `/api/admin/students?studioId` | 원생 목록 |
| POST | `/api/admin/students` | 원생 등록 |
| PATCH | `/api/admin/students/[id]` | 원생 수정 |
| DELETE | `/api/admin/students/[id]` | 원생 비활성화 |
| GET | `/api/admin/schedules?studioId&from&to` | 일정 조회 (FullCalendar 형식) |
| POST | `/api/admin/schedules` | 레슨 일정 생성 |
| PATCH | `/api/admin/schedules/[id]` | 일정 상태 변경 |
| GET | `/api/admin/payments?studioId&month&status` | 수강료 목록 |
| POST | `/api/admin/payments` | 수강료 등록 |
| PATCH | `/api/admin/payments/[id]` | 납부 처리 |
| POST | `/api/admin/notifications/send` | 카카오톡 일괄 발송 |

### 원생 API
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/student/schedule?from&to` | 내 레슨 일정 |
| GET | `/api/student/payments` | 내 납부 내역 |
| GET | `/api/student/practice` | 연습 기록 + 활성 세션 |
| POST | `/api/student/practice` | 연습 시작 |
| PATCH | `/api/student/practice/[id]` | 연습 종료 |
| GET | `/api/student/stats` | 연습/레슨/납부 통계 |

### 인증 API
| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/auth/register` | 학원/관리자 회원가입 |
| * | `/api/auth/[...nextauth]` | NextAuth 핸들러 |

---

## ⚙️ 로컬 실행 방법

### 1. 의존성 설치
```bash
npm install
```

### 2. 환경변수 설정
```bash
cp .env.example .env
# .env 파일에 DATABASE_URL, AUTH_SECRET 등 입력
```

### 3. DB 마이그레이션 + 시드
```bash
npx prisma migrate dev --name init
npm run db:seed
```

### 4. 개발 서버 실행
```bash
npm run dev
```

---

## 🔐 테스트 계정 (Seed 데이터)

| 역할 | 이메일 | 비밀번호 |
|------|--------|----------|
| **관리자** | admin@piano-academy.com | Admin1234! |
| 원생 1 | student1@test.com | Student1234! |
| 원생 2 | student2@test.com | Student1234! |
| 원생 3 | student3@test.com | Student1234! |

---

## 📱 카카오톡 알림 연동 흐름

```
1. 원생 → 카카오 OAuth 로그인
   ↓  scope: talk_message 동의
2. KakaoLink 테이블에 토큰 저장
   ↓
3. 관리자 → 알림 발송 버튼 클릭
   ↓
4. 서버: KakaoLink.accessToken 조회
   ↓  만료 시 refreshToken으로 갱신
5. POST https://kapi.kakao.com/v2/api/talk/memo/default/send
   ↓
6. KakaoNotification 테이블에 발송 이력 기록
```

---

## 🎯 MVP 기능 우선순위

| 우선순위 | 기능 | 상태 |
|---------|------|------|
| P0 | 관리자/원생 인증 (이메일+비번) | ✅ |
| P0 | 원생 CRUD | ✅ |
| P0 | 수강료 등록 + 납부 처리 | ✅ |
| P1 | 레슨 일정 달력 (FullCalendar) | ✅ |
| P1 | 연습 세션 시작/종료 + 통계 | ✅ |
| P1 | 카카오톡 알림 발송 | ✅ |
| P2 | 카카오 OAuth 로그인 | ✅ (설정 필요) |
| P3 | 다중 학원 멀티테넌시 확장 | 구조 준비됨 |
| P3 | 이메일 알림 | 미구현 |

---

## 🚀 Vercel 배포

```bash
# Vercel CLI
npx vercel --prod

# 환경변수 설정 (Vercel Dashboard)
DATABASE_URL=...          # Neon 또는 Supabase PostgreSQL URL
AUTH_SECRET=...           # openssl rand -base64 32
NEXTAUTH_URL=...          # https://your-domain.vercel.app
KAKAO_CLIENT_ID=...
KAKAO_CLIENT_SECRET=...
```

> **DB 권장**: Neon (serverless, Vercel 통합) 또는 Supabase (Row-Level Security 활용 가능)

---

## 🧪 테스트 실행

```bash
npm test              # 전체 테스트 실행
npm run test:watch    # watch 모드
npm run test:coverage # 커버리지 리포트
```
