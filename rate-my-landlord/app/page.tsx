"use client";

import { Star } from "lucide-react";
import { useEffect, useState } from "react";

type Review = {
  id: number;
  landlord: string;
  rating: number;
  comment: string;
};

export default function Home() {

  const [reviews, setReviews] = useState<Review[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [landlord, setLandlord] = useState("");
  const [rating, setRating] = useState(1);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");

  async function loadReviews() {
    const response = await fetch("/api/reviews");
    const data = await response.json();

    console.log(data);

    setReviews(data);
  }

  useEffect(() => {
    loadReviews();
  }, []);

  async function submitReview(e: React.FormEvent) {
    e.preventDefault();

    if (editingId !== null) {
      await fetch(`/api/reviews/${editingId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          landlord,
          rating,
          comment,
        }),
      });

      setEditingId(null);
    } else {
      await fetch("/api/reviews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          landlord,
          rating,
          comment,
        }),
      });
    }

    setLandlord("");
    setRating(1);
    setComment("");
    loadReviews();
  }

  async function deleteReview(id: number) {
    await fetch(`/api/reviews/${id}`, {
      method: "DELETE",
    });

    loadReviews();
  }

  return (
    <main className="p-8 max-w-2xl mx-auto">

      <h1 className="text-4xl font-bold mb-6">
        Rate My Landlord
      </h1>

      <form
        onSubmit={submitReview}
        className="space-y-4 mb-8"
      >

        <input
          type="text"
          placeholder="Landlord name"
          value={landlord}
          onChange={(e) => setLandlord(e.target.value)}
          className="border p-2 w-full rounded"
        />

        <div className="flex gap-1">

          {[1, 2, 3, 4, 5].map((star) => {

            const active = hoverRating || rating;

            return (
              <Star
                key={star}
                size={32}
                className={`cursor-pointer transition ${
                  star <= active
                    ? "fill-yellow-400 text-yellow-400"
                    : "text-gray-400"
                }`}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                onClick={() => setRating(star)}
              />
            );
          })}

        </div>

        <textarea
          placeholder="Write your review..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="border p-2 w-full rounded"
        />

        <button
          type="submit"
          className="bg-black text-white px-4 py-2 rounded"
        >
          Submit Review
        </button>

      </form>

      <div className="space-y-4">

        {Array.isArray(reviews) && reviews.map((review) => (

          <div
            key={review.id}
            className="border p-4 rounded-lg"
          >

            <h2 className="text-2xl font-semibold">
              {review.landlord}
            </h2>

            <p>
              Rating: {review.rating}/5
            </p>

            <p>
              {review.comment}
            </p>

            <button
              onClick={() => deleteReview(review.id)}
              className="bg-red-500 text-white px-3 py-1 rounded mt-3"
            >
              Delete
            </button>

            <button
              onClick={() => {

                setEditingId(review.id);

                setLandlord(review.landlord);
                setRating(review.rating);
                setComment(review.comment);

              }}
              className="bg-blue-500 text-white px-3 py-1 rounded mt-3 ml-2"
            >
              Edit
            </button>

          </div>

        ))}

      </div>

    </main>
  );
}