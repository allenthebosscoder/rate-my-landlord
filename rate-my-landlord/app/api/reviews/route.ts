import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const res = await fetch("http://localhost:8080/reviews");
  const reviews = await res.json();

  return new Response(JSON.stringify(reviews), {
    status: res.status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
