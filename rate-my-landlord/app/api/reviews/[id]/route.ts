import type { NextRequest } from "next/server";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

export async function PUT(
  request: NextRequest,
  { params }: Params
) {

  const { id } = await params;

  const body = await request.json();

  const response = await fetch(
    `http://localhost:8080/reviews/${id}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  const data = await response.json();

  return Response.json(data);
}

export async function DELETE(
  request: NextRequest,
  { params }: Params
) {

  const { id } = await params;

  const response = await fetch(
    `http://localhost:8080/reviews/${id}`,
    {
      method: "DELETE",
    }
  );

  const data = await response.json();

  return Response.json(data);
}