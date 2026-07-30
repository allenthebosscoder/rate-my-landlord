import type { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get("Authorization") ?? "";

    const response = await fetch("http://localhost:8080/auth/logout", {
      method: "POST",
      headers: { Authorization: authorization },
    });

    if (!response.ok && response.status !== 204) {
      const errorText = await response.text();
      console.error("Backend error:", response.status, errorText);
      return Response.json(
        { error: `Backend error: ${errorText}` },
        { status: response.status }
      );
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("POST /api/auth/logout error:", error);
    return Response.json(
      { error: `Internal server error: ${error}` },
      { status: 500 }
    );
  }
}
