import type { NextRequest } from "next/server";
import { BACKEND_URL } from "@/app/api/_lib/backend";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const response = await fetch(`${BACKEND_URL}/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({ error: "Something went wrong" }));
    return Response.json(data, { status: response.status });
  } catch (error) {
    console.error("POST /api/auth/reset-password error:", error);
    return Response.json(
      { error: `Internal server error: ${error}` },
      { status: 500 }
    );
  }
}
