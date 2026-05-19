"use client";

import { Star } from "lucide-react";
import { useEffect, useState } from "react";

type Review = {
  id: number;
  landlord: string;
  rating: number;
  comment: string;
  city?: string;
  state?: string;
  country?: string;
};

export default function Home() {

  const [reviews, setReviews] = useState<Review[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [landlord, setLandlord] = useState("");
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [hasSelected, setHasSelected] = useState(false);
  const [isHoveringStars, setIsHoveringStars] = useState(false);
  const [comment, setComment] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [country, setCountry] = useState("");
  const [error, setError] = useState("");

  async function loadReviews() {
    try {
      const response = await fetch("/api/reviews");
      if (!response.ok) {
        console.error("API error:", response.status, response.statusText);
        setReviews([]);
        return;
      }
      const text = await response.text();
      console.log("Raw response:", text);
      if (!text) {
        console.log("Empty response from API");
        setReviews([]);
        return;
      }
      const data = JSON.parse(text);
      console.log(data);
      setReviews(data);
    } catch (err) {
      console.error("Failed to load reviews:", err);
      setReviews([]);
    }
  }

  useEffect(() => {
    loadReviews();
  }, []);

  async function submitReview(e: React.FormEvent) {
    e.preventDefault();

    // Collect all validation errors
    const errors: string[] = [];
    
    if (!landlord.trim()) {
      errors.push("Landlord name");
    }
    if (!country.trim()) {
      errors.push("Country");
    }
    if (rating === 0) {
      errors.push("Rating");
    }

    if (errors.length > 0) {
      setError(`Missing required fields: ${errors.join(", ")}`);
      return;
    }

    setError("");

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
          city,
          state,
          country,
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
          city,
          state,
          country,
        }),
      });
    }

    setLandlord("");
    setRating(0);
    setComment("");
    setCity("");
    setState("");
    setCountry("");
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

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">
            Landlord name <span className="text-red-600">*</span>
          </label>
          <input
            type="text"
            placeholder="Landlord name"
            value={landlord}
            onChange={(e) => setLandlord(e.target.value)}
            className="border p-2 w-full rounded"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            City
          </label>
          <input
            type="text"
            placeholder="City"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="border p-2 w-full rounded"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            State
          </label>
          <input
            type="text"
            placeholder="State"
            value={state}
            onChange={(e) => setState(e.target.value)}
            className="border p-2 w-full rounded"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Country <span className="text-red-600">*</span>
          </label>
          <input
            type="text"
            placeholder="Country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="border p-2 w-full rounded"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Rating <span className="text-red-600">*</span>
          </label>
          <div
            className="flex gap-1"
            onMouseEnter={() => setIsHoveringStars(true)}
            onMouseLeave={() => {
              setIsHoveringStars(false);
              setHoverRating(0);
            }}
          >

          {[1, 2, 3, 4, 5].map((star) => {
            const active = hoverRating || rating;

            // calculate fill percent for this star (supports halves)
            const rawFill = Math.min(Math.max(active - (star - 1), 0), 1);
            const fillPercent = Math.round(rawFill * 100);

            const isHovered = hoverRating > 0 && Math.ceil(hoverRating) === star;
            const currentOpacity = isHoveringStars ? 0.6 : isHovered ? 0.6 : 1;

            return (
              <div
                key={star}
                className="relative w-8 h-8"
                onMouseMove={(e: React.MouseEvent) => {
                  const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                  const isLeft = e.clientX < rect.left + rect.width / 2;
                  const hoverValue = isLeft ? star - 0.5 : star;
                  setHoverRating(hoverValue);
                }}
                
                onClick={() => {
                  const clicked = hoverRating || star;
                  setRating(clicked);
                  setHasSelected(true);
                }}
              >
                {/* base (empty) star */}
                <Star size={32} className="text-gray-400" style={{ opacity: currentOpacity }} />

                {/* overlay (filled) star clipped to percentage */}
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    width: `${fillPercent}%`,
                    height: "100%",
                    overflow: "hidden",
                    pointerEvents: "none",
                    transition: "width 120ms ease",
                    opacity: currentOpacity,
                  }}
                >
                  <Star size={32} className="fill-yellow-400 text-yellow-400" />
                </div>
              </div>
            );
          })}

        </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Review
          </label>
          <textarea
            placeholder="Write your review..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="border p-2 w-full rounded"
          />
        </div>

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

            <p className="text-sm text-gray-600">
              {[review.city, review.state, review.country].filter(Boolean).join(", ")}
            </p>

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
                setCity(review.city || "");
                setState(review.state || "");
                setCountry(review.country || "");

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