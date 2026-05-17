"use client";

import { useEffect, useState } from "react";

type Review = {
  id: number;
  landlord: string;
  rating: number;
  comment: string;
};

export default function Home() {

  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => {

    fetch("/api/reviews")
      .then((response) => response.json())
      .then((data) => {
        setReviews(data);
      })
      .catch((error) => {
        console.error("Fetch failed:", error);
      });

  }, []);

  return (
    <main className="p-8">

      <h1 className="text-4xl font-bold mb-6">
        Rate My Landlord
      </h1>

      <div className="space-y-4">

        {reviews?.map((review) => (

          <div
            key={review.id}
            className="border p-4 rounded-lg"
          >
            <h2 className="text-2xl font-semibold">
              {review?.landlord}
            </h2>

            <p>
              Rating: {review.rating}/5
            </p>

            <p>
              {review.comment}
            </p>

          </div>

        ))}

      </div>

    </main>
  );
}