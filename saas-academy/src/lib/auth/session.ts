/**
 * src/lib/auth/session.ts
 *
 * Server-side session reader: extracts the current user from the
 * access-token cookie for use in Server Components and Route Handlers.
 */
import { cookies } from "next/headers";
import { verifyAccessToken } from "./jwt";

export type CurrentUser = {
  id:        string;
  role:      string;
  academyId: string | null;
};

/** Read + verify the access-token cookie; returns null if missing/invalid */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    const store = await cookies();
    const token = store.get("sa_access")?.value;
    if (!token) return null;
    const payload = await verifyAccessToken(token);
    if (!payload) return null;
    return {
      id:        payload.sub,
      role:      payload.role,
      academyId: payload.academyId,
    };
  } catch {
    return null;
  }
}
