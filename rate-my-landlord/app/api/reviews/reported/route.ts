import type { NextRequest } from "next/server";
import { BACKEND_URL } from "@/app/api/_lib/backend";

export async function GET(request: NextRequest) {
  try {
    const response = await fetch(`${BACKEND_URL}/reviews/reported`, {
      headers: {
        Authorization: request.headers.get("Authorization") ?? "",
      },
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({ error: "Failed to load reported reviews" }));
      return Response.json(data, { status: response.status });
    }

    const data = await response.json();
    return Response.json(data);
  } catch (error) {
    console.error("GET /api/reviews/reported error:", error);
    return Response.json(
      { error: `Internal server error: ${error}` },
      { status: 500 }
    );
  }
}
