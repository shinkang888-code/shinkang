# KPI Definitions — Academy Owner Dashboard

> Timezone: **Asia/Seoul (KST, UTC+9)**  
> All date-range filters use KST local dates. Timestamps stored in UTC are converted at query time.

---

## 1. Revenue KPIs

### Total Paid Amount
- **Definition**: Sum of `Invoice.amount` where `Invoice.status = 'PAID'` and `Invoice.paidAt` falls within the selected range (KST).
- **Recognition rule**: Revenue is recognized when payment succeeds (`paidAt` is set). Pending invoices are NOT counted.
- **Unit**: KRW (integer).

### Paid Count
- **Definition**: Count of invoices satisfying the same conditions as Total Paid Amount.

### Outstanding Amount
- **Definition**: Sum of `Invoice.amount` where `Invoice.status = 'PENDING'` and `Invoice.dueDate` (KST calendar date) falls within the range.
- **Note**: Invoices due but not yet paid. Does not imply delinquency (see §5).

### Failed Count
- **Definition**: Count of invoices where `Invoice.status = 'FAILED'` and `Invoice.updatedAt` falls within the range.

### Collection Rate
- **Formula**: `paidCount / (paidCount + outstandingCount)`
- **Edge case**: If denominator is 0, rate = 0 (not applicable).
- **Precision**: 4 decimal places (e.g., 0.8750 = 87.5%).

---

## 2. Student KPIs

### Active Students
- **Definition**: Count of `User` records with `role = 'STUDENT'`, `status = 'ACTIVE'`, scoped to `academyId`.
- **Note**: Point-in-time snapshot at time of query, not range-dependent.

### New Students
- **Definition**: Count of students (`role = 'STUDENT'`) whose `createdAt` falls within the selected KST range.

### Churned Students (Proxy)
- **Definition**: Count of **distinct students** who have a `ClassEnrollment` record with `status = 'DROPPED'` and `enrolledAt` within the selected range.
- **Limitation**: `ClassEnrollment` does not store a `droppedAt` timestamp. The `enrolledAt` field is used as a proxy.  
  ⚠️ Future improvement: add `droppedAt DateTime?` to `ClassEnrollment` for accurate churn tracking.

### Attendance Participants
- **Definition**: Count of distinct `studentUserId` values in `Attendance` records linked to `ClassSession` rows whose `localDate` (KST) falls within the range.

---

## 3. Attendance KPIs

### Scheduled Sessions
- **Definition**: Count of `ClassSession` records where `status != 'CANCELED'` and `localDate` is within the range.

### Completed Sessions
- **Definition**: Count of `ClassSession` records where `status = 'COMPLETED'` and `localDate` is within the range.

### Attendance Rate
- **Numerator**: Count of `Attendance` records where `status IN ('PRESENT', 'LATE')` within the range.
- **Denominator** (default, `excludeExcused = true`):  
  Count of `Attendance` records where `status IN ('PRESENT', 'LATE', 'ABSENT')`.  
  **EXCUSED is excluded from the denominator** because it represents justified absences that should not penalize the rate.
- **Alternative** (`excludeExcused = false`): Denominator includes EXCUSED.
- **Formula**: `(PRESENT + LATE) / denominator`
- **Edge case**: If denominator = 0, rate = 0.

### Late Rate
- **Numerator**: Count of `Attendance` where `status = 'LATE'` in range.
- **Denominator**: Count of `Attendance` where `status IN ('PRESENT', 'LATE', 'ABSENT')` in range.
- **Note**: EXCUSED is always excluded from both numerator and denominator of late rate.

---

## 4. Teacher KPIs

### Active Teachers
- **Definition**: Count of distinct `Class.teacherUserId` values appearing in non-canceled `ClassSession` rows within the range.

### Top Teachers by Sessions
- **Definition**: Top 5 teachers ranked by number of non-canceled sessions they taught within the range.
- **Join path**: `ClassSession → Class.teacherUserId → User`

### Top Teachers by Attendance Rate
- **Definition**: Top 5 teachers ranked by `(PRESENT + LATE) / (PRESENT + LATE + ABSENT)` across all students in their sessions within the range.
- **Minimum**: Only teachers with at least 1 attendance record (PRESENT/LATE/ABSENT) are included.

---

## 5. Risk KPIs

### At-Risk Students
- **Definition**: Students with **ABSENT count ≥ 3 in the rolling last 30 days** (from time of query, not the selected range).
- **Calculation**: `Attendance.status = 'ABSENT'` and `Attendance.createdAt >= NOW() - 30 days`, scoped to `academyId`.
- **Output**: List sorted by absence count descending, showing `absentCount30d` and `lastSessionDate`.

### Delinquent Students
- **Definition**: Students who have at least one `Invoice` where:
  - `Invoice.status = 'PENDING'`
  - `Invoice.dueDate < today (KST) - delinquencyDays` (default: **7 days**)
- **Output**: List showing total overdue amount and max overdue days, sorted by overdue amount descending.
- **Configurable**: `delinquencyDays` defaults to 7 but can be set per query.

---

## 6. Notifications Health

### Queued Count
- **Definition**: Total `NotificationQueue` rows created within the selected range (regardless of status).

### Failed Count
- **Definition**: `NotificationQueue` rows with `status = 'FAILED'` created within the range.

---

## 7. Timeseries Buckets

| Bucket | Description |
|--------|-------------|
| `day`  | Each data point represents one KST calendar day |
| `week` | Each data point represents one ISO week (Monday-start) |

**Zero-fill**: All buckets in the requested range are always returned, with `value = 0` for days/weeks with no data.

---

## 8. API Query Parameters

| Param  | Format      | Default         | Description |
|--------|-------------|-----------------|-------------|
| `from` | `YYYY-MM-DD`| 1st of current month (KST) | Range start (KST) |
| `to`   | `YYYY-MM-DD`| Last day of current month (KST) | Range end (KST, inclusive) |
| `bucket` | `day\|week` | `day`          | Timeseries granularity |

---

## 9. Access Control

| Role         | Access |
|--------------|--------|
| `ADMIN`      | Own academy only (`academyId` from JWT) |
| `SUPER_ADMIN`| Any academy (pass `academyId` as query param) |
| `TEACHER`    | ❌ Forbidden (403) |
| `STUDENT`    | ❌ Forbidden (403) |
