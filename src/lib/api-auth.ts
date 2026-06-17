import { auth } from "@/auth";
import { NextResponse } from "next/server";

export async function requireAuth(): Promise<
  { email: string } | { error: NextResponse }
> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return {
      error: NextResponse.json(
        { success: false, error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      ),
    };
  }
  return { email };
}

export function quotaResponse(
  message: string,
  code: string,
  status: number,
  extra?: Record<string, unknown>
) {
  return NextResponse.json(
    { success: false, error: message, code, ...extra },
    { status }
  );
}
