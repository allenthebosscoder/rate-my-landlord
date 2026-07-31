import type { NextRequest } from "next/server";
import { BACKEND_URL } from "@/app/api/_lib/backend";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(
  request: NextRequest,
  { params }: Params
) {
  try {
    const { id } = await params;

    const response = await fetch(
      `${BACKEND_URL}/reviews/${id}/report`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: request.headers.get("Authorization") ?? "",
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Backend error:", response.status, errorText);
      return Response.json(
        { error: `Backend error: ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return Response.json(data);
  } catch (error) {
    console.error("POST /api/reviews/[id]/report error:", error);
    return Response.json(
      { error: `Internal server error: ${error}` },
      { status: 500 }
    );
  }
}
