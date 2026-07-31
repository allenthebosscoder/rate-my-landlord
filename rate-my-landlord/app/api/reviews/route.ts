import type { NextRequest } from "next/server";
import { BACKEND_URL } from "@/app/api/_lib/backend";

export async function GET(request: NextRequest) {
  try {
    const response = await fetch(
      `${BACKEND_URL}/reviews`,
      {
        headers: {
          Authorization: request.headers.get("Authorization") ?? "",
        },
      }
    );

    if (!response.ok) {
      console.error("Backend error:", response.status, response.statusText);
      return Response.json(
        { error: "Failed to fetch reviews" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return Response.json(data);
  } catch (error) {
    console.error("GET /api/reviews error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log("POST /api/reviews body:", body);

    const response = await fetch(
      `${BACKEND_URL}/reviews`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: request.headers.get("Authorization") ?? "",
        },
        body: JSON.stringify(body),
      }
    );

    console.log("Backend response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Backend error:", response.status, errorText);
      return Response.json(
        { error: `Backend error: ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log("Backend response data:", data);
    return Response.json(data);
  } catch (error) {
    console.error("POST /api/reviews error:", error);
    return Response.json(
      { error: `Internal server error: ${error}` },
      { status: 500 }
    );
  }
}