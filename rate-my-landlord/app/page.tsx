"use client";

import { Star, ThumbsUp, ThumbsDown, Flag, Share2, MoreVertical, Pencil, Trash2, EyeOff } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

type Review = {
  id: number;
  rating: number;
  comment: string;
  tenantName: string;
  showName?: boolean;
  tenantLocation: string;
  tenure: string;
  categories: string;
  helpfulCount: number;
  unhelpfulCount: number;
  myVote?: "HELPFUL" | "UNHELPFUL" | null;
  isReported: boolean;
  createdAt?: string;
  updatedAt?: string;
  owner?: {
    id: number;
    username: string;
  };
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

type Page = "view" | "add" | "auth";

type Auth = { token: string; username: string } | null;

const AUTH_TOKEN_KEY = "rml_token";
const AUTH_USERNAME_KEY = "rml_username";
const authListeners = new Set<() => void>();
let cachedAuth: Auth | undefined;

function readAuthFromStorage(): Auth {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  const username = localStorage.getItem(AUTH_USERNAME_KEY);
  return token && username ? { token, username } : null;
}

function getAuthSnapshot(): Auth {
  if (cachedAuth === undefined) {
    cachedAuth = readAuthFromStorage();
  }
  return cachedAuth;
}

function getServerAuthSnapshot(): Auth {
  return null;
}

function subscribeAuth(callback: () => void) {
  authListeners.add(callback);
  return () => {
    authListeners.delete(callback);
  };
}

function setAuth(auth: Auth) {
  if (auth) {
    localStorage.setItem(AUTH_TOKEN_KEY, auth.token);
    localStorage.setItem(AUTH_USERNAME_KEY, auth.username);
  } else {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USERNAME_KEY);
  }
  cachedAuth = auth;
  authListeners.forEach((listener) => listener());
}

type Country = { country: string };
type StateOption = { name: string };

type NewReviewPayload = {
  rating: number;
  comment: string;
  tenantName: string;
  showName: boolean;
  tenantLocation: string;
  tenure: string;
  categories: string;
  property: {
    zipCode: string;
    city: string;
    state: string;
    country: string;
    landlord: { name: string };
  };
};

const CATEGORY_OPTIONS = [
  "All Reviews",
  "Tenant Experience",
  "Communication",
  "Maintenance",
  "Value",
];

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

type SortOption = "relevance" | "recent" | "helpful" | "highest" | "lowest";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "relevance", label: "Sort by: Relevance" },
  { value: "recent", label: "Sort by: Most Recent" },
  { value: "helpful", label: "Sort by: Most Helpful" },
  { value: "highest", label: "Sort by: Highest Rating" },
  { value: "lowest", label: "Sort by: Lowest Rating" },
];

// Combines net votes with a gentle time decay so relevance considers both how
// helpful a review is and how recent it is. Same shape as the Hacker News /
// Reddit "hot" ranking (score decayed by a power of age), but tuned for a much
// slower shelf life: those algorithms decay over hours since a news post is
// stale within a day, while a landlord review is still useful for months, so
// the exponent here is far gentler and age is measured in days, not hours.
function relevanceScore(review: Review): number {
  const netVotes = review.helpfulCount - review.unhelpfulCount;
  const ageInDays = review.createdAt
    ? Math.max(0, (Date.now() - new Date(review.createdAt).getTime()) / 86_400_000)
    : 0;
  return (netVotes + 1) / Math.pow(ageInDays + 2, 0.3);
}

function sortReviews(list: Review[], sortBy: SortOption): Review[] {
  const sorted = [...list];
  switch (sortBy) {
    case "recent":
      sorted.sort(
        (a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
      );
      break;
    case "helpful":
      sorted.sort((a, b) => b.helpfulCount - a.helpfulCount);
      break;
    case "highest":
      sorted.sort((a, b) => b.rating - a.rating);
      break;
    case "lowest":
      sorted.sort((a, b) => a.rating - b.rating);
      break;
    case "relevance":
    default:
      sorted.sort((a, b) => relevanceScore(b) - relevanceScore(a));
      break;
  }
  return sorted;
}

export default function Home() {
  const auth = useSyncExternalStore(subscribeAuth, getAuthSnapshot, getServerAuthSnapshot);
  const token = auth?.token ?? null;
  const username = auth?.username ?? null;

  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const [currentPage, setCurrentPage] = useState<Page>("view");
  const [selectedLandlord, setSelectedLandlord] = useState<string | null>(null);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("All Reviews");
  const [sortBy, setSortBy] = useState<SortOption>("relevance");
  const orderSignatureRef = useRef<string | null>(null);
  const [orderedIds, setOrderedIds] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const [reviews, setReviews] = useState<Review[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [landlordName, setLandlordName] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [country, setCountry] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [tenantLocation, setTenantLocationForm] = useState("");
  const [tenure, setTenure] = useState("");
  const [categories, setFormCategories] = useState<string[]>([]);
  const [showName, setShowName] = useState(true);
  const [error, setError] = useState("");

  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(timer);
  }, [toast]);

  const [countries, setCountries] = useState<Country[]>([]);
  const [states, setStates] = useState<StateOption[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);

  async function loadReviews(overrideToken?: string | null) {
    const authToken = overrideToken !== undefined ? overrideToken : token;
    try {
      const response = await fetch("/api/reviews", {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      });
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
    // Initial data load on mount; loadReviews/loadCountries only touch state
    // after their fetch resolves, so this isn't a synchronous setState-in-effect.
    // Intentionally run once on mount only — loadReviews is redefined every
    // render (it closes over `token`), so depending on it would refetch on
    // every render instead of just once.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadReviews();
    loadCountries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleAuthFailure(status: number): boolean {
    if (status === 401) {
      setAuth(null);
      setError("Your session has expired. Please sign in again.");
      setCurrentPage("auth");
      return true;
    }
    if (status === 403) {
      setError("You can only edit your own reviews.");
      return true;
    }
    return false;
  }

  async function submitReview(e: React.FormEvent) {
    e.preventDefault();

    if (!token) {
      setCurrentPage("auth");
      return;
    }

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

    const reviewData: NewReviewPayload = {
      rating,
      comment,
      tenantName,
      showName,
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
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(reviewData),
        });
        if (!response.ok) {
          if (!handleAuthFailure(response.status)) {
            setError("Failed to update review");
          }
          return;
        }
        setEditingId(null);
      } else {
        const response = await fetch("/api/reviews", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(reviewData),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Failed to submit review:", response.status, errorText);
          if (!handleAuthFailure(response.status)) {
            setError(`Failed to submit review (Status: ${response.status})`);
          }
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
      setShowName(true);
      setFormCategories([]);

      setTimeout(() => {
        loadReviews();
      }, 500);
    } catch (err) {
      console.error("Error submitting review:", err);
      setError("Error submitting review. Check console for details.");
    }
  }

  async function confirmDelete(id: number) {
    if (!token) {
      setCurrentPage("auth");
      return;
    }
    const response = await fetch(`/api/reviews/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    setConfirmDeleteId(null);
    if (!response.ok) {
      handleAuthFailure(response.status);
      return;
    }
    loadReviews();
  }

  function requireSignIn(message: string): boolean {
    if (!token) {
      setToast(message);
      return false;
    }
    return true;
  }

  function handleVoteFailure(status: number) {
    if (status === 401) {
      setAuth(null);
      setToast("Your session expired. Please sign in again.");
      loadReviews(null);
    } else {
      setToast("Something went wrong. Please try again.");
    }
  }

  async function markHelpful(id: number) {
    if (!requireSignIn("Sign in to vote on a review")) return;
    const response = await fetch(`/api/reviews/${id}/helpful`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      handleVoteFailure(response.status);
      return;
    }
    loadReviews();
  }

  async function markUnhelpful(id: number) {
    if (!requireSignIn("Sign in to vote on a review")) return;
    const response = await fetch(`/api/reviews/${id}/unhelpful`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      handleVoteFailure(response.status);
      return;
    }
    loadReviews();
  }

  async function reportReview(id: number) {
    if (!requireSignIn("Sign in to report a review")) return;
    const response = await fetch(`/api/reviews/${id}/report`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    setOpenMenuId(null);
    if (!response.ok) {
      handleVoteFailure(response.status);
      return;
    }
    loadReviews();
  }

  async function seedDevReviews() {
    await fetch("/api/dev/seed?count=30", { method: "POST" });
    loadReviews();
  }

  function goHome() {
    setCurrentPage("view");
    setSelectedLandlord(null);
    setEditingId(null);
    setSearchQuery("");
    setError("");
  }

  async function submitAuth(e: React.FormEvent) {
    e.preventDefault();

    if (!authUsername.trim() || !authPassword) {
      setAuthError("Username and password are required");
      return;
    }
    if (authMode === "register" && authPassword.length < 8) {
      setAuthError("Password must be at least 8 characters");
      return;
    }

    setAuthError("");
    setAuthLoading(true);
    try {
      const response = await fetch(`/api/auth/${authMode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: authUsername.trim(), password: authPassword }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setAuthError(data?.error || "Something went wrong. Please try again.");
        return;
      }

      setAuth({ token: data.token, username: data.username });
      setAuthUsername("");
      setAuthPassword("");
      goHome();
      loadReviews(data.token);
    } catch (err) {
      console.error("Auth error:", err);
      setAuthError("Network error. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function logOut() {
    if (token) {
      fetch("/api/auth/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }).catch((err) => console.error("Logout error:", err));
    }
    setAuth(null);
    goHome();
    loadReviews(null);
  }

  const landlords = Array.from(
    new Map(
      (reviews || [])
        .filter((r) => r.property?.landlord?.name)
        .map((r) => [r.property!.landlord!.id, r.property!.landlord!.name])
    ).values()
  );

  const searchedLandlords = (() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return landlords;
    return landlords.filter((landlord) => {
      if (landlord.toLowerCase().includes(query)) return true;
      return (reviews || []).some(
        (r) =>
          r.property?.landlord?.name === landlord &&
          [r.property?.city, r.property?.state, r.property?.country, r.property?.zipCode].some(
            (field) => field?.toLowerCase().includes(query)
          )
      );
    });
  })();

  const filteredReviews = (reviews || [])
    .filter((r) => !selectedLandlord || r.property?.landlord?.name === selectedLandlord)
    .filter((r) => !selectedRating || Math.round(r.rating) === selectedRating)
    .filter((r) => {
      if (selectedCategory === "All Reviews") return true;
      const cats = r.categories?.split(",").map((c) => c.trim()) || [];
      return cats.includes(selectedCategory);
    });

  // Display order is intentionally "frozen": it's only recomputed when the
  // user explicitly changes sort/filter/landlord (orderSignature changes).
  // Background refreshes (e.g. after voting) update counts in place without
  // visibly reshuffling the list — jumping reviews around on every vote is
  // confusing. Newly-created reviews that weren't part of the frozen order
  // get appended, sorted among themselves, rather than forcing a full resort.
  const orderSignature = `${selectedLandlord ?? ""}|${selectedRating ?? ""}|${selectedCategory}|${sortBy}`;

  useEffect(() => {
    // The ref read/write lives directly in the effect body, not inside the
    // setState updater — updater functions must be pure (React may invoke
    // them more than once to check that), so mutating a ref inside one is
    // unreliable and was the cause of sort changes not taking effect.
    const isNewView = orderSignatureRef.current !== orderSignature;
    orderSignatureRef.current = orderSignature;

    if (isNewView) {
      setOrderedIds(sortReviews(filteredReviews, sortBy).map((r) => r.id));
    } else {
      setOrderedIds((prevIds) => {
        const knownIds = new Set(prevIds);
        const newReviews = filteredReviews.filter((r) => !knownIds.has(r.id));
        if (newReviews.length === 0) return prevIds;
        return [...prevIds, ...sortReviews(newReviews, sortBy).map((r) => r.id)];
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderSignature, reviews]);

  const filteredReviewsById = new Map(filteredReviews.map((r) => [r.id, r]));
  const displayedReviews = orderedIds
    .map((id) => filteredReviewsById.get(id))
    .filter((r): r is Review => Boolean(r));

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
            <button
              onClick={goHome}
              className="text-2xl font-bold text-blue-600 hover:text-blue-700 transition-colors"
            >
              RateMyLandlord
            </button>
            <div className="hidden md:flex gap-6">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSelectedLandlord(null);
                  setCurrentPage("view");
                }}
                placeholder="Search for a landlord, property management company, or location..."
                className="px-4 py-2 border rounded-lg w-96 text-sm"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                if (!username) {
                  setAuthMode("login");
                  setCurrentPage("auth");
                  return;
                }
                if (!tenantName.trim()) {
                  setTenantName(username);
                }
                setError("");
                setCurrentPage("add");
                setSelectedLandlord(null);
              }}
              className="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50"
            >
              Write a Review
            </button>
            {process.env.NODE_ENV === "development" && (
              <button
                onClick={seedDevReviews}
                title="Dev only: generate random test reviews"
                className="px-3 py-2 text-xs border border-dashed border-gray-400 text-gray-500 rounded-lg hover:bg-gray-50"
              >
                🎲 Seed Reviews
              </button>
            )}
            {username ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-700">
                  Signed in as <span className="font-medium">{username}</span>
                </span>
                <button
                  onClick={logOut}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm"
                >
                  Log Out
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setAuthMode("login");
                  setCurrentPage("auth");
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Sign In
              </button>
            )}
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
                  {searchedLandlords.length === 0 && (
                    <p className="text-sm text-gray-600">
                      No landlords match &quot;{searchQuery}&quot;.
                    </p>
                  )}
                  <div className="space-y-2">
                    {searchedLandlords.map((landlord) => {
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
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as SortOption)}
                      className="px-3 py-2 border rounded-lg text-sm"
                    >
                      {SORT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
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
                    {displayedReviews.map((review) => (
                      <div key={review.id} className="bg-white rounded-lg border p-6">
                        {/* Review Header */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex gap-4">
                            <div
                              className={`w-12 h-12 rounded-full ${
                                review.showName === false
                                  ? "bg-gray-400"
                                  : getInitialsColor(review.tenantName)
                              } flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}
                            >
                              {review.showName === false ? (
                                <EyeOff size={18} />
                              ) : (
                                getInitials(review.tenantName)
                              )}
                            </div>
                            <div>
                              <p className="font-semibold flex items-center gap-2">
                                {review.showName === false ? "Anonymous" : review.tenantName}
                                {review.showName === false && (
                                  <span className="text-xs font-normal text-gray-500">
                                    (name hidden)
                                  </span>
                                )}
                              </p>
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
                                  className={
                                    i < Math.round(review.rating)
                                      ? "fill-yellow-400 text-yellow-400"
                                      : "text-gray-300"
                                  }
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
                                className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
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
                              className={`flex items-center gap-2 text-sm transition-colors ${
                                review.myVote === "HELPFUL"
                                  ? "text-green-600 font-medium"
                                  : "text-gray-600 hover:text-green-600"
                              }`}
                            >
                              <ThumbsUp
                                size={16}
                                fill={review.myVote === "HELPFUL" ? "currentColor" : "none"}
                              />
                              <span>{review.helpfulCount}</span>
                            </button>
                            <button
                              onClick={() => markUnhelpful(review.id)}
                              className={`flex items-center gap-2 text-sm transition-colors ${
                                review.myVote === "UNHELPFUL"
                                  ? "text-red-600 font-medium"
                                  : "text-gray-600 hover:text-red-600"
                              }`}
                            >
                              <ThumbsDown
                                size={16}
                                fill={review.myVote === "UNHELPFUL" ? "currentColor" : "none"}
                              />
                              <span>{review.unhelpfulCount}</span>
                            </button>
                          </div>
                          <div className="relative">
                            <button
                              onClick={() =>
                                setOpenMenuId(openMenuId === review.id ? null : review.id)
                              }
                              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                              aria-label="More actions"
                            >
                              <MoreVertical size={18} />
                            </button>

                            {openMenuId === review.id && (
                              <>
                                <div
                                  className="fixed inset-0 z-10"
                                  onClick={() => setOpenMenuId(null)}
                                />
                                <div className="absolute right-0 mt-1 w-44 bg-white border rounded-lg shadow-lg z-20 py-1">
                                  <button
                                    onClick={() => reportReview(review.id)}
                                    className={`w-full flex items-center gap-2 text-left px-4 py-2 text-sm transition-colors ${
                                      review.isReported
                                        ? "text-red-600"
                                        : "text-gray-600 hover:bg-gray-100"
                                    }`}
                                  >
                                    <Flag size={14} />
                                    {review.isReported ? "Reported" : "Report"}
                                  </button>
                                  {username && review.owner?.username === username && (
                                    <>
                                      <button
                                        onClick={() => {
                                          setEditingId(review.id);
                                          setLandlordName(review.property?.landlord?.name || "");
                                          setZipCode(review.property?.zipCode || "");
                                          setRating(review.rating);
                                          setComment(review.comment || "");
                                          setCity(review.property?.city || "");
                                          setState(review.property?.state || "");
                                          setCountry(review.property?.country || "");
                                          setTenantName(review.tenantName || "");
                                          setTenantLocationForm(review.tenantLocation || "");
                                          setTenure(review.tenure || "");
                                          setShowName(review.showName ?? true);
                                          setFormCategories(
                                            review.categories?.split(",").map((c) => c.trim()) || []
                                          );
                                          setError("");
                                          setOpenMenuId(null);
                                          setCurrentPage("add");
                                        }}
                                        className="w-full flex items-center gap-2 text-left px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 transition-colors"
                                      >
                                        <Pencil size={14} />
                                        Edit
                                      </button>
                                      <button
                                        onClick={() => {
                                          setOpenMenuId(null);
                                          setConfirmDeleteId(review.id);
                                        }}
                                        className="w-full flex items-center gap-2 text-left px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 transition-colors"
                                      >
                                        <Trash2 size={14} />
                                        Delete
                                      </button>
                                    </>
                                  )}
                                </div>
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
                <label className="flex items-center gap-2 mt-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showName}
                    onChange={(e) => setShowName(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-gray-600">Display my name on this review</span>
                </label>
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
                {countries.map((c) => (
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
                  {states.map((s) => (
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
                  {cities.map((c) => (
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
              <div className="flex gap-2" onMouseLeave={() => setHoverRating(0)}>
                {[1, 2, 3, 4, 5].map((star) => {
                  const active = hoverRating || rating;
                  const filled = star <= active;
                  return (
                    <button
                      key={star}
                      type="button"
                      onMouseEnter={() => setHoverRating(star)}
                      onClick={() => setRating(star)}
                    >
                      <Star
                        size={40}
                        className={filled ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}
                      />
                    </button>
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
                  <label key={cat} className="flex items-center gap-2 cursor-pointer">
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
                    setShowName(true);
                    setFormCategories([]);
                    setError("");
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

      {/* Sign In / Sign Up Page */}
      {currentPage === "auth" && (
        <div className="max-w-md mx-auto px-4 py-16">
          <div className="bg-white rounded-lg border p-8">
            <h2 className="text-2xl font-bold mb-1">
              {authMode === "login" ? "Sign In" : "Create an Account"}
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              {authMode === "login"
                ? "Sign in to write and manage your reviews."
                : "Sign up to start writing reviews."}
            </p>

            <form onSubmit={submitAuth} className="space-y-4">
              {authError && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded text-sm">
                  {authError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-2">Username</label>
                <input
                  type="text"
                  value={authUsername}
                  onChange={(e) => setAuthUsername(e.target.value)}
                  autoComplete="username"
                  className="border p-2 w-full rounded"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Password</label>
                <input
                  type="password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  autoComplete={authMode === "login" ? "current-password" : "new-password"}
                  className="border p-2 w-full rounded"
                />
                {authMode === "register" && (
                  <p className="text-xs text-gray-500 mt-1">At least 8 characters.</p>
                )}
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
              >
                {authLoading ? "Please wait..." : authMode === "login" ? "Sign In" : "Sign Up"}
              </button>
            </form>

            <p className="text-sm text-gray-600 mt-6 text-center">
              {authMode === "login" ? (
                <>
                  Don&apos;t have an account?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode("register");
                      setAuthError("");
                    }}
                    className="text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Sign up
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode("login");
                      setAuthError("");
                    }}
                    className="text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Sign in
                  </button>
                </>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteId !== null && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-lg border shadow-xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold mb-2">Delete this review?</h3>
            <p className="text-sm text-gray-600 mb-6">
              This can&apos;t be undone. The review will be permanently removed.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="px-4 py-2 rounded-lg border text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => confirmDelete(confirmDeleteId)}
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
          <div className="toast-fade bg-gray-900 text-white text-sm px-4 py-2 rounded-lg shadow-lg">
            {toast}
          </div>
        </div>
      )}
    </main>
  );
}