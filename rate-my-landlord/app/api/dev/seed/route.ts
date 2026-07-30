import type { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const count = request.nextUrl.searchParams.get("count") ?? "10";

    const response = await fetch(
      `http://localhost:8080/dev/seed-reviews?count=${encodeURIComponent(count)}`,
      { method: "POST" }
    );

    if (!response.ok) {
      const data = await response.json().catch(() => ({ error: "Seeding failed" }));
      return Response.json(data, { status: response.status });
    }

    const data = await response.json();
    return Response.json(data);
  } catch (error) {
    console.error("POST /api/dev/seed error:", error);
    return Response.json(
      { error: `Internal server error: ${error}` },
      { status: 500 }
    );
  }
}
