import { handlers } from "@/Backend/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: Request | NextRequest) {
  try {
    const req = request instanceof NextRequest ? request : new NextRequest(request);
    return await handlers.GET(req);
  } catch (error) {
    console.error("[NextAuth GET Handler Error]:", error);
    return NextResponse.json({ error: "Authentication service error", session: null }, { status: 500 });
  }
}

export async function POST(request: Request | NextRequest) {
  try {
    const req = request instanceof NextRequest ? request : new NextRequest(request);
    return await handlers.POST(req);
  } catch (error) {
    console.error("[NextAuth POST Handler Error]:", error);
    return NextResponse.json({ error: "Authentication service error" }, { status: 500 });
  }
}
