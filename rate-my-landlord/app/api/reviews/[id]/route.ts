import type { NextRequest } from "next/server";
import { BACKEND_URL } from "@/app/api/_lib/backend";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

export async function PUT(
  request: NextRequest,
  { params }: Params
) {
  try {
    const { id } = await params;

    const body = await request.json();

    const response = await fetch(
      `${BACKEND_URL}/reviews/${id}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: request.headers.get("Authorization") ?? "",
        },
        body: JSON.stringify(body),
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
    console.error("PUT /api/reviews/[id] error:", error);
    return Response.json(
      { error: `Internal server error: ${error}` },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: Params
) {
  try {
    const { id } = await params;

    const response = await fetch(
      `${BACKEND_URL}/reviews/${id}`,
      {
        method: "DELETE",
        headers: {
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

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("DELETE /api/reviews/[id] error:", error);
    return Response.json(
      { error: `Internal server error: ${error}` },
      { status: 500 }
    );
  }
}