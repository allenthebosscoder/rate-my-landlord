import type { NextRequest } from "next/server";
import { BACKEND_URL } from "@/app/api/_lib/backend";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const response = await fetch(`${BACKEND_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({ error: "Registration failed" }));
      console.error("Backend error:", response.status, data);
      return Response.json(data, { status: response.status });
    }

    const data = await response.json();
    return Response.json(data);
  } catch (error) {
    console.error("POST /api/auth/register error:", error);
    return Response.json(
      { error: `Internal server error: ${error}` },
      { status: 500 }
    );
  }
}
