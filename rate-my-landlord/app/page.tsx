"use client";

import { Star } from "lucide-react";
import { useEffect, useState } from "react";

type Review = {
  id: number;
  rating: number;
  comment: string;
  createdAt?: string;
  updatedAt?: string;
  property?: {
    id: number;
    zipCode: string;
    city?: string;
    state?: string;
    country?: string;
    landlord?: {
      id: number;
      name: string;
    };
  };
};

type Page = "view" | "add";

export default function Home() {
  const [currentPage, setCurrentPage] = useState<Page>("view");
  
  const [reviews, setReviews] = useState<Review[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [landlordName, setLandlordName] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [hasSelected, setHasSelected] = useState(false);
  const [isHoveringStars, setIsHoveringStars] = useState(false);
  const [comment, setComment] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [country, setCountry] = useState("");
  const [error, setError] = useState("");
  
  const [countries, setCountries] = useState<any[]>([]);
  const [states, setStates] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);

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
      console.log("Parsed reviews:", data);
      if (Array.isArray(data)) {
        setReviews(data);
      } else if (data.data && Array.isArray(data.data)) {
        setReviews(data.data);
      } else {
        console.error("Unexpected response format:", data);
        setReviews([]);
      }
    } catch (err) {
      console.error("Failed to load reviews:", err);
      setReviews([]);
    }
  }

  async function loadCountries() {
    try {
      setLoadingLocations(true);
      const response = await fetch("https://countriesnow.space/api/v0.1/countries");
      const data = await response.json();
      console.log("Countries API response:", data);
      if (data.data) {
        console.log("Setting countries:", data.data);
        setCountries(data.data);
      }
    } catch (err) {
      console.error("Failed to load countries:", err);
    } finally {
      setLoadingLocations(false);
    }
  }

  async function loadStates(countryName: string) {
    try {
      setLoadingLocations(true);
      setState("");
      setCities([]);
      const response = await fetch("https://countriesnow.space/api/v0.1/countries/states", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country: countryName }),
      });
      const data = await response.json();
      if (data.data && data.data.states) {
        setStates(data.data.states);
      }
    } catch (err) {
      console.error("Failed to load states:", err);
      setStates([]);
    } finally {
      setLoadingLocations(false);
    }
  }

  async function loadCities(countryName: string, stateName: string) {
    try {
      setLoadingLocations(true);
      setCity("");
      const response = await fetch("https://countriesnow.space/api/v0.1/countries/state/cities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country: countryName, state: stateName }),
      });
      const data = await response.json();
      if (data.data) {
        setCities(data.data);
      }
    } catch (err) {
      console.error("Failed to load cities:", err);
      setCities([]);
    } finally {
      setLoadingLocations(false);
    }
  }

  useEffect(() => {
    loadReviews();
    loadCountries();
  }, []);

  async function submitReview(e: React.FormEvent) {
    e.preventDefault();

    // Collect all validation errors
    const errors: string[] = [];
    
    if (!landlordName.trim()) {
      errors.push("Landlord name");
    }
    if (!zipCode.trim()) {
      errors.push("Zip code");
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

    const reviewData: any = {
      rating,
      comment,
      property: {
        zipCode,
        city,
        state,
        country,
        landlord: {
          name: landlordName,
        },
      },
    };

    try {
      if (editingId !== null) {
        const response = await fetch(`/api/reviews/${editingId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(reviewData),
        });
        console.log("Update response:", response.status);
        setEditingId(null);
      } else {
        const response = await fetch("/api/reviews", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(reviewData),
        });
        console.log("Create response status:", response.status);
        console.log("Create response ok:", response.ok);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error("API error response status:", response.status);
          console.error("API error response body:", errorText);
          setError(`Failed to submit review (Status: ${response.status})`);
          return;
        }
        const responseData = await response.json();
        console.log("Response data:", responseData);
      }

      setLandlordName("");
      setZipCode("");
      setRating(0);
      setComment("");
      setCity("");
      setState("");
      setCountry("");
      
      // Give the backend a moment to process, then reload
      setTimeout(() => {
        loadReviews();
      }, 500);
    } catch (err) {
      console.error("Error submitting review:", err);
      setError("Error submitting review. Check console for details.");
    }
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

      {/* Navigation Buttons */}
      <div className="flex gap-4 mb-8">
        <button
          onClick={() => setCurrentPage("view")}
          className={`px-4 py-2 rounded font-medium transition-colors ${
            currentPage === "view"
              ? "bg-black text-white"
              : "bg-gray-200 text-black hover:bg-gray-300"
          }`}
        >
          View Reviews
        </button>
        <button
          onClick={() => setCurrentPage("add")}
          className={`px-4 py-2 rounded font-medium transition-colors ${
            currentPage === "add"
              ? "bg-black text-white"
              : "bg-gray-200 text-black hover:bg-gray-300"
          }`}
        >
          Add Review
        </button>
      </div>

      {/* View Reviews Page */}
      {currentPage === "view" && (
        <div className="space-y-4">
          {Array.isArray(reviews) && reviews.map((review) => (
            <div
              key={review.id}
              className="border p-4 rounded-lg"
            >
              <h2 className="text-2xl font-semibold">
                {review.property?.landlord?.name}
              </h2>

              <p className="text-sm text-gray-600 mb-2">
                Property: {review.property?.zipCode}
              </p>

              <p className="text-sm text-gray-600">
                {[review.property?.city, review.property?.state, review.property?.country].filter(Boolean).join(", ")}
              </p>

              <p className="mt-2">
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
                  setLandlordName(review.property?.landlord?.name || "");
                  setZipCode(review.property?.zipCode || "");
                  setRating(review.rating);
                  setComment(review.comment);
                  setCity(review.property?.city || "");
                  setState(review.property?.state || "");
                  setCountry(review.property?.country || "");
                  setCurrentPage("add");
                }}
                className="bg-blue-500 text-white px-3 py-1 rounded mt-3 ml-2"
              >
                Edit
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add Review Page */}
      {currentPage === "add" && (
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
              value={landlordName}
              onChange={(e) => setLandlordName(e.target.value)}
              className="border p-2 w-full rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Country <span className="text-red-600">*</span>
            </label>
            <select
              value={country}
              onChange={(e) => {
                setCountry(e.target.value);
                if (e.target.value) {
                  loadStates(e.target.value);
                }
              }}
              disabled={loadingLocations}
              className="border p-2 w-full rounded disabled:bg-gray-100"
            >
              <option value="">Select a country...</option>
              {countries.map((c: any) => (
                <option key={c.country} value={c.country}>
                  {c.country}
                </option>
              ))}
            </select>
          </div>

          {states.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-1">
                State / Province
              </label>
              <select
                value={state}
                onChange={(e) => {
                  setState(e.target.value);
                  if (e.target.value && country) {
                    loadCities(country, e.target.value);
                  }
                }}
                disabled={loadingLocations}
                className="border p-2 w-full rounded disabled:bg-gray-100"
              >
                <option value="">Select a state...</option>
                {states.map((s: any) => (
                  <option key={s.name} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {cities.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-1">
                City
              </label>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                disabled={loadingLocations}
                className="border p-2 w-full rounded disabled:bg-gray-100"
              >
                <option value="">Select a city...</option>
                {cities.map((c: string) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">
              Zip Code <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              placeholder="Zip code"
              value={zipCode}
              onChange={(e) => setZipCode(e.target.value)}
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

          <div className="flex gap-2">
            <button
              type="submit"
              className="bg-black text-white px-4 py-2 rounded"
            >
              {editingId ? "Update Review" : "Submit Review"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setLandlordName("");
                  setZipCode("");
                  setRating(0);
                  setComment("");
                  setCity("");
                  setState("");
                  setCountry("");
                  setError("");
                }}
                className="bg-gray-500 text-white px-4 py-2 rounded"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      )}
    </main>
  );
}