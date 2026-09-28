import { handlers } from "@/Backend/lib/auth";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    return await handlers.GET(request);
  } catch (error) {
    console.error("[NextAuth GET Handler Error]:", error);
    return NextResponse.json({ error: "Authentication service error", session: null }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    return await handlers.POST(request);
  } catch (error) {
    console.error("[NextAuth POST Handler Error]:", error);
    return NextResponse.json({ error: "Authentication service error" }, { status: 500 });
  }
}


