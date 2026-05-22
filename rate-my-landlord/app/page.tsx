"use client";

import { Star, ThumbsUp, ThumbsDown, Flag, Share2 } from "lucide-react";
import { useEffect, useState } from "react";

type Review = {
  id: number;
  rating: number;
  comment: string;
  tenantName: string;
  tenantLocation: string;
  tenure: string;
  categories: string;
  helpfulCount: number;
  unhelpfulCount: number;
  isReported: boolean;
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

const CATEGORY_OPTIONS = [
  "All Reviews",
  "Tenant Experience",
  "Communication",
  "Maintenance",
  "Value",
];

const STAR_COLORS: { [key: number]: string } = {
  5: "text-green-500",
  4: "text-blue-500",
  3: "text-yellow-500",
  2: "text-orange-500",
  1: "text-red-500",
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getInitialsColor(name: string): string {
  const colors = [
    "bg-blue-400",
    "bg-purple-400",
    "bg-pink-400",
    "bg-indigo-400",
    "bg-cyan-400",
  ];
  return colors[name.charCodeAt(0) % colors.length];
}

export default function Home() {
  const [currentPage, setCurrentPage] = useState<Page>("view");
  const [selectedLandlord, setSelectedLandlord] = useState<string | null>(null);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("All Reviews");

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
  const [tenantName, setTenantName] = useState("");
  const [tenantLocation, setTenantLocationForm] = useState("");
  const [tenure, setTenure] = useState("");
  const [categories, setFormCategories] = useState<string[]>([]);
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
      if (!text) {
        setReviews([]);
        return;
      }
      const data = JSON.parse(text);
      if (Array.isArray(data)) {
        setReviews(data);
      } else if (data.data && Array.isArray(data.data)) {
        setReviews(data.data);
      } else {
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
      if (data.data) {
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

    const errors: string[] = [];
    if (!landlordName.trim()) errors.push("Landlord name");
    if (!zipCode.trim()) errors.push("Zip code");
    if (!country.trim()) errors.push("Country");
    if (rating === 0) errors.push("Rating");
    if (!tenantName.trim()) errors.push("Tenant name");

    if (errors.length > 0) {
      setError(`Missing required fields: ${errors.join(", ")}`);
      return;
    }

    setError("");

    const reviewData: any = {
      rating,
      comment,
      tenantName,
      tenantLocation,
      tenure,
      categories: categories.join(","),
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
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(reviewData),
        });
        if (!response.ok) {
          setError(`Failed to update review`);
          return;
        }
        setEditingId(null);
      } else {
        const response = await fetch("/api/reviews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(reviewData),
        });

        if (!response.ok) {
          const errorText = await response.text();
          setError(`Failed to submit review (Status: ${response.status})`);
          return;
        }
      }

      setLandlordName("");
      setZipCode("");
      setRating(0);
      setComment("");
      setCity("");
      setState("");
      setCountry("");
      setTenantName("");
      setTenantLocationForm("");
      setTenure("");
      setFormCategories([]);

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

  async function markHelpful(id: number) {
    await fetch(`/api/reviews/${id}/helpful`, {
      method: "POST",
    });
    loadReviews();
  }

  async function markUnhelpful(id: number) {
    await fetch(`/api/reviews/${id}/unhelpful`, {
      method: "POST",
    });
    loadReviews();
  }

  async function reportReview(id: number) {
    await fetch(`/api/reviews/${id}/report`, {
      method: "POST",
    });
    loadReviews();
  }

  const landlords = Array.from(
    new Map(
      (reviews || []).map((r) => [r.property?.landlord?.id, r.property?.landlord?.name])
    ).entries()
  ).map(([id, name]) => name);

  const filteredReviews = (reviews || [])
    .filter((r) => !selectedLandlord || r.property?.landlord?.name === selectedLandlord)
    .filter((r) => !selectedRating || r.rating === selectedRating)
    .filter((r) => {
      if (selectedCategory === "All Reviews") return true;
      const cats = r.categories?.split(",").map((c) => c.trim()) || [];
      return cats.includes(selectedCategory);
    });

  const ratingDistribution = () => {
    const dist: { [key: number]: number } = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    (selectedLandlord
      ? filteredReviews
      : reviews || []
    ).forEach((r) => {
      dist[Math.round(r.rating)]++;
    });
    return dist;
  };

  const distribution = ratingDistribution();
  const totalReviews = selectedLandlord
    ? filteredReviews.length
    : reviews?.length || 0;
  const avgRating =
    totalReviews > 0
      ? (filteredReviews.reduce((sum, r) => sum + r.rating, 0) / filteredReviews.length).toFixed(1)
      : "0.0";

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header Navigation */}
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <h1 className="text-2xl font-bold text-blue-600">RateMyLandlord</h1>
            <div className="hidden md:flex gap-6">
              <input
                type="text"
                placeholder="Search for a landlord, property management company, or location..."
                className="px-4 py-2 border rounded-lg w-96 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => {
                setCurrentPage("add");
                setSelectedLandlord(null);
              }}
              className="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50"
            >
              Write a Review
            </button>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              Sign Up
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      {currentPage === "view" && (
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex gap-6">
            {/* Left Sidebar */}
            <div className="w-80 flex-shrink-0">
              {selectedLandlord && (
                <>
                  {/* Landlord Card */}
                  <div className="bg-white rounded-lg border p-6 mb-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h2 className="text-2xl font-bold">{selectedLandlord}</h2>
                        <p className="text-sm text-gray-600">Property Management Company</p>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-bold">{avgRating}</div>
                        <div className="flex gap-1">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              size={16}
                              className={`${
                                i < Math.floor(parseFloat(avgRating))
                                  ? "fill-yellow-400 text-yellow-400"
                                  : "text-gray-300"
                              }`}
                            />
                          ))}
                        </div>
                        <p className="text-xs text-gray-600 mt-1">Based on {totalReviews} reviews</p>
                      </div>
                    </div>
                  </div>

                  {/* Rating Distribution */}
                  <div className="bg-white rounded-lg border p-6 mb-6">
                    <h3 className="font-bold mb-4">Rating Distribution</h3>
                    {[5, 4, 3, 2, 1].map((rating) => (
                      <div key={rating} className="flex items-center gap-3 mb-3">
                        <span className="flex items-center gap-1 w-12">
                          <span className="text-sm font-medium">{rating}</span>
                          <Star size={14} className="fill-yellow-400 text-yellow-400" />
                        </span>
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-yellow-400 h-2 rounded-full"
                            style={{
                              width: `${
                                totalReviews > 0
                                  ? (distribution[rating] / totalReviews) * 100
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                        <span className="text-sm text-gray-600 w-8 text-right">
                          {totalReviews > 0
                            ? Math.round((distribution[rating] / totalReviews) * 100)
                            : 0}
                          %
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Rating Filter */}
                  <div className="bg-white rounded-lg border p-6 mb-6">
                    <h3 className="font-bold mb-4">Filter by Rating</h3>
                    <div className="space-y-2">
                      {[5, 4, 3, 2, 1].map((r) => (
                        <button
                          key={r}
                          onClick={() =>
                            setSelectedRating(selectedRating === r ? null : r)
                          }
                          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${
                            selectedRating === r
                              ? "bg-blue-100 text-blue-700"
                              : "bg-gray-100 hover:bg-gray-200"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedRating === r}
                            readOnly
                            className="w-4 h-4"
                          />
                          <span className="text-sm">
                            {r} Star{r !== 1 ? "s" : ""}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-2">
                    <button className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50">
                      <Share2 size={18} />
                      Share
                    </button>
                  </div>
                </>
              )}

              {!selectedLandlord && landlords.length > 0 && (
                <div className="bg-white rounded-lg border p-6">
                  <h3 className="font-bold mb-4">Select a Landlord</h3>
                  <div className="space-y-2">
                    {landlords.map((landlord) => {
                      const landlordReviews = reviews?.filter(
                        (r) => r.property?.landlord?.name === landlord
                      ) || [];
                      const avg =
                        landlordReviews.length > 0
                          ? (
                              landlordReviews.reduce((sum, r) => sum + r.rating, 0) /
                              landlordReviews.length
                            ).toFixed(1)
                          : "0.0";

                      return (
                        <button
                          key={landlord}
                          onClick={() => setSelectedLandlord(landlord)}
                          className="w-full text-left px-4 py-3 border rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium">{landlord}</p>
                              <p className="text-xs text-gray-600">
                                {landlordReviews.length} review
                                {landlordReviews.length !== 1 ? "s" : ""}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-sm">{avg}</p>
                              <div className="flex gap-0.5">
                                {[...Array(5)].map((_, i) => (
                                  <Star
                                    key={i}
                                    size={12}
                                    className={
                                      i < Math.floor(parseFloat(avg))
                                        ? "fill-yellow-400 text-yellow-400"
                                        : "text-gray-300"
                                    }
                                  />
                                ))}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Right Content */}
            <div className="flex-1">
              {selectedLandlord && (
                <>
                  {/* Reviews Header */}
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold">Reviews ({filteredReviews.length})</h2>
                    <select className="px-3 py-2 border rounded-lg text-sm">
                      <option>Sort by: Most Recent</option>
                      <option>Sort by: Most Helpful</option>
                      <option>Sort by: Highest Rating</option>
                      <option>Sort by: Lowest Rating</option>
                    </select>
                  </div>

                  {/* Category Tabs */}
                  <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                    {CATEGORY_OPTIONS.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-4 py-2 rounded-full whitespace-nowrap transition-colors ${
                          selectedCategory === cat
                            ? "bg-blue-600 text-white"
                            : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  {/* Reviews List */}
                  <div className="space-y-4">
                    {filteredReviews.map((review) => (
                      <div key={review.id} className="bg-white rounded-lg border p-6">
                        {/* Review Header */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex gap-4">
                            <div
                              className={`w-12 h-12 rounded-full ${getInitialsColor(
                                review.tenantName
                              )} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}
                            >
                              {getInitials(review.tenantName)}
                            </div>
                            <div>
                              <p className="font-semibold">{review.tenantName}</p>
                              <p className="text-sm text-gray-600">
                                Tenant {review.tenure && `• ${review.tenure}`}
                              </p>
                              {review.tenantLocation && (
                                <p className="text-sm text-gray-600">📍 {review.tenantLocation}</p>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="flex justify-end gap-1 mb-1">
                              {[...Array(5)].map((_, i) => (
                                <Star
                                  key={i}
                                  size={16}
                                  className={`${
                                    i < Math.round(review.rating)
                                      ? `fill-yellow-400 ${STAR_COLORS[Math.round(review.rating)]}`
                                      : "text-gray-300"
                                  }`}
                                />
                              ))}
                            </div>
                            <p className="text-xs text-gray-600">
                              {new Date(review.createdAt || "").toLocaleDateString()}
                            </p>
                          </div>
                        </div>

                        {/* Review Content */}
                        <p className="text-gray-700 mb-3">{review.comment}</p>

                        {/* Categories */}
                        {review.categories && (
                          <div className="flex flex-wrap gap-2 mb-4">
                            {review.categories.split(",").map((cat) => (
                              <span
                                key={cat}
                                className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded"
                              >
                                {cat.trim()}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center justify-between pt-4 border-t">
                          <div className="flex gap-4">
                            <button
                              onClick={() => markHelpful(review.id)}
                              className="flex items-center gap-2 text-sm text-gray-600 hover:text-green-600 transition-colors"
                            >
                              <ThumbsUp size={16} />
                              <span>{review.helpfulCount}</span>
                            </button>
                            <button
                              onClick={() => markUnhelpful(review.id)}
                              className="flex items-center gap-2 text-sm text-gray-600 hover:text-red-600 transition-colors"
                            >
                              <ThumbsDown size={16} />
                              <span>{review.unhelpfulCount}</span>
                            </button>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => reportReview(review.id)}
                              className={`flex items-center gap-1 text-sm transition-colors ${
                                review.isReported
                                  ? "text-red-600"
                                  : "text-gray-600 hover:text-red-600"
                              }`}
                            >
                              <Flag size={16} />
                            </button>
                            {editingId !== review.id && (
                              <>
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
                                    setTenantName(review.tenantName);
                                    setTenantLocationForm(review.tenantLocation);
                                    setTenure(review.tenure);
                                    setFormCategories(
                                      review.categories?.split(",").map((c) => c.trim()) || []
                                    );
                                    setCurrentPage("add");
                                  }}
                                  className="text-sm text-blue-600 hover:text-blue-700"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => deleteReview(review.id)}
                                  className="text-sm text-red-600 hover:text-red-700"
                                >
                                  Delete
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Review Page */}
      {currentPage === "add" && (
        <div className="max-w-2xl mx-auto px-4 py-6">
          <button
            onClick={() => {
              setCurrentPage("view");
              setEditingId(null);
            }}
            className="text-blue-600 hover:text-blue-700 mb-4"
          >
            ← Back
          </button>

          <h2 className="text-3xl font-bold mb-6">
            {editingId ? "Edit Review" : "Write a Review"}
          </h2>

          <form onSubmit={submitReview} className="space-y-6 bg-white rounded-lg border p-6">
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Landlord / Company Name <span className="text-red-600">*</span>
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
                <label className="block text-sm font-medium mb-2">
                  Your Name <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Your name"
                  value={tenantName}
                  onChange={(e) => setTenantName(e.target.value)}
                  className="border p-2 w-full rounded"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Your Location
                </label>
                <input
                  type="text"
                  placeholder="City, State"
                  value={tenantLocation}
                  onChange={(e) => setTenantLocationForm(e.target.value)}
                  className="border p-2 w-full rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Tenure (e.g., 2022 - 2024)
                </label>
                <input
                  type="text"
                  placeholder="Tenure period"
                  value={tenure}
                  onChange={(e) => setTenure(e.target.value)}
                  className="border p-2 w-full rounded"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
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
                <label className="block text-sm font-medium mb-2">
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
                <label className="block text-sm font-medium mb-2">
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
              <label className="block text-sm font-medium mb-2">
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
              <label className="block text-sm font-medium mb-3">
                Rating <span className="text-red-600">*</span>
              </label>
              <div
                className="flex gap-2"
                onMouseEnter={() => setIsHoveringStars(true)}
                onMouseLeave={() => {
                  setIsHoveringStars(false);
                  setHoverRating(0);
                }}
              >
                {[1, 2, 3, 4, 5].map((star) => {
                  const active = hoverRating || rating;
                  const rawFill = Math.min(Math.max(active - (star - 1), 0), 1);
                  const fillPercent = Math.round(rawFill * 100);
                  const isHovered = hoverRating > 0 && Math.ceil(hoverRating) === star;
                  const currentOpacity = isHoveringStars ? 0.6 : isHovered ? 0.6 : 1;

                  return (
                    <div
                      key={star}
                      className="relative w-10 h-10 cursor-pointer"
                      onMouseMove={(e: React.MouseEvent) => {
                        const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                        const isLeft = e.clientX < rect.left + rect.width / 2;
                        setHoverRating(isLeft ? star - 0.5 : star);
                      }}
                      onClick={() => {
                        setRating(hoverRating || star);
                        setHasSelected(true);
                      }}
                    >
                      <Star
                        size={40}
                        className="text-gray-300"
                        style={{ opacity: currentOpacity }}
                      />
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
                        <Star size={40} className="fill-yellow-400 text-yellow-400" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Review Categories
              </label>
              <div className="space-y-2">
                {["Communication", "Maintenance", "Value", "Tenant Experience"].map((cat) => (
                  <label key={cat} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={categories.includes(cat)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormCategories([...categories, cat]);
                        } else {
                          setFormCategories(categories.filter((c) => c !== cat));
                        }
                      }}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">{cat}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Your Review
              </label>
              <textarea
                placeholder="Write your detailed review here..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="border p-2 w-full rounded h-24"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                {editingId ? "Update Review" : "Submit Review"}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={() => {
                    setCurrentPage("view");
                    setEditingId(null);
                    setLandlordName("");
                    setZipCode("");
                    setRating(0);
                    setComment("");
                    setCity("");
                    setState("");
                    setCountry("");
                    setTenantName("");
                    setTenantLocationForm("");
                    setTenure("");
                    setFormCategories([]);
                  }}
                  className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 font-medium"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </main>
  );
}