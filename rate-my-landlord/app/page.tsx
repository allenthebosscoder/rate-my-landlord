"use client";

import { Star, ThumbsUp, ThumbsDown, Flag, Share2, MoreVertical, Pencil, Trash2, EyeOff, Building2 } from "lucide-react";
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

type Page = "view" | "add" | "auth" | "moderation";

type Auth = { token: string; username: string; isAdmin: boolean } | null;

const AUTH_TOKEN_KEY = "rml_token";
const AUTH_USERNAME_KEY = "rml_username";
const AUTH_IS_ADMIN_KEY = "rml_is_admin";
const authListeners = new Set<() => void>();
let cachedAuth: Auth | undefined;

function readAuthFromStorage(): Auth {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  const username = localStorage.getItem(AUTH_USERNAME_KEY);
  const isAdmin = localStorage.getItem(AUTH_IS_ADMIN_KEY) === "true";
  return token && username ? { token, username, isAdmin } : null;
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
    localStorage.setItem(AUTH_IS_ADMIN_KEY, String(auth.isAdmin));
  } else {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USERNAME_KEY);
    localStorage.removeItem(AUTH_IS_ADMIN_KEY);
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

const MONTH_OPTIONS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const CURRENT_YEAR = new Date().getFullYear();
const TENURE_YEARS = Array.from({ length: 21 }, (_, i) => String(CURRENT_YEAR - i));

function formatTenure(startMonth: string, startYear: string, endMonth: string, endYear: string): string {
  const start = startYear ? (startMonth ? `${startMonth} ${startYear}` : startYear) : "";
  const end = endYear ? (endMonth ? `${endMonth} ${endYear}` : endYear) : "";
  if (start && end) return `${start} - ${end}`;
  return start || end;
}

// Best-effort parse of previously free-typed tenure strings ("2022 - 2024",
// "January 2022 - March 2024") back into structured fields for editing.
// Anything that doesn't match just comes back blank rather than guessing.
function parseTenure(tenure: string): {
  startMonth: string;
  startYear: string;
  endMonth: string;
  endYear: string;
} {
  const empty = { startMonth: "", startYear: "", endMonth: "", endYear: "" };
  const parts = tenure.split(" - ").map((p) => p.trim());
  if (parts.length !== 2) return empty;

  const parsePart = (part: string) => {
    const match = part.match(/^(?:([A-Za-z]+)\s+)?(\d{4})$/);
    if (!match) return { month: "", year: "" };
    const [, month, year] = match;
    return { month: month && MONTH_OPTIONS.includes(month) ? month : "", year };
  };

  const start = parsePart(parts[0]);
  const end = parsePart(parts[1]);
  return { startMonth: start.month, startYear: start.year, endMonth: end.month, endYear: end.year };
}

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
  const isAdmin = auth?.isAdmin ?? false;

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
  const browseGridRef = useRef<HTMLDivElement>(null);

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
  const [tenureStartMonth, setTenureStartMonth] = useState("");
  const [tenureStartYear, setTenureStartYear] = useState("");
  const [tenureEndMonth, setTenureEndMonth] = useState("");
  const [tenureEndYear, setTenureEndYear] = useState("");
  const [categories, setFormCategories] = useState<string[]>([]);
  const [showName, setShowName] = useState(true);
  const [error, setError] = useState("");

  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [reportedReviews, setReportedReviews] = useState<Review[]>([]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    // Switching pages (or between the landlord grid and a landlord's detail
    // view) swaps in entirely different content, but the browser keeps
    // whatever scroll position you were at — landing you mid-page on a
    // layout you haven't scrolled in yet. Snap back to the top on every
    // such transition.
    window.scrollTo({ top: 0 });
  }, [currentPage, selectedLandlord]);

  useEffect(() => {
    // Keep the moderation nav badge count fresh whenever admin status
    // changes (sign in/out), not just when the moderation page is opened.
    if (isAdmin) {
      loadReportedReviews();
    } else {
      // Clearing stale admin-only data the instant admin status is revoked.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReportedReviews([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

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

  async function loadReportedReviews() {
    if (!token) {
      setReportedReviews([]);
      return;
    }
    try {
      const response = await fetch("/api/reviews/reported", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        setReportedReviews([]);
        return;
      }
      const data = await response.json();
      setReportedReviews(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load reported reviews:", err);
      setReportedReviews([]);
    }
  }

  async function dismissReviewReport(id: number) {
    if (!token) return;
    const response = await fetch(`/api/reviews/${id}/dismiss-report`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      handleActionFailure(response.status);
      return;
    }
    loadReportedReviews();
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

  async function loadStates(countryName: string, keepSelection = false) {
    try {
      setLoadingLocations(true);
      if (!keepSelection) {
        setState("");
        setCities([]);
      }
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

  async function loadCities(countryName: string, stateName: string, keepSelection = false) {
    try {
      setLoadingLocations(true);
      if (!keepSelection) {
        setCity("");
      }
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
      tenantLocation: [city, state].filter(Boolean).join(", ") || country,
      tenure: formatTenure(tenureStartMonth, tenureStartYear, tenureEndMonth, tenureEndYear),
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
      setTenureStartMonth("");
      setTenureStartYear("");
      setTenureEndMonth("");
      setTenureEndYear("");
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
    if (isAdmin) {
      loadReportedReviews();
    }
  }

  function requireSignIn(message: string): boolean {
    if (!token) {
      setToast(message);
      return false;
    }
    return true;
  }

  function handleActionFailure(status: number) {
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
      handleActionFailure(response.status);
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
      handleActionFailure(response.status);
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
      handleActionFailure(response.status);
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

  function startWritingReview() {
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
  }

  function scrollToBrowseGrid() {
    browseGridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
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

      setAuth({ token: data.token, username: data.username, isAdmin: Boolean(data.isAdmin) });
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
          <div className="flex items-center gap-3">
            <button
              onClick={startWritingReview}
              className="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 whitespace-nowrap"
            >
              Write a Review
            </button>
            {process.env.NODE_ENV === "development" && (
              <button
                onClick={seedDevReviews}
                title="Dev only: generate random test reviews"
                className="hidden lg:block px-3 py-2 text-xs border border-dashed border-gray-400 text-gray-500 rounded-lg hover:bg-gray-50 whitespace-nowrap"
              >
                🎲 Seed Reviews
              </button>
            )}
            {username ? (
              <div className="relative">
                <button
                  onClick={() => setAccountMenuOpen(!accountMenuOpen)}
                  className="flex items-center gap-2 pl-2 pr-3 py-1.5 border rounded-full hover:bg-gray-50"
                >
                  <div
                    className={`w-7 h-7 rounded-full ${getInitialsColor(
                      username
                    )} flex items-center justify-center text-white font-bold text-xs flex-shrink-0`}
                  >
                    {getInitials(username)}
                  </div>
                  <span className="hidden sm:inline text-sm font-medium max-w-[10rem] truncate">
                    {username}
                  </span>
                  {isAdmin && reportedReviews.length > 0 && (
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                  )}
                </button>

                {accountMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setAccountMenuOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-56 bg-white border rounded-lg shadow-lg z-20 py-1">
                      <div className="px-4 py-2 text-xs text-gray-500 border-b">
                        Signed in as <span className="font-medium text-gray-700">{username}</span>
                      </div>
                      {process.env.NODE_ENV === "development" && (
                        <button
                          onClick={() => {
                            seedDevReviews();
                            setAccountMenuOpen(false);
                          }}
                          className="lg:hidden w-full text-left px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
                        >
                          🎲 Seed Reviews
                        </button>
                      )}
                      {isAdmin && (
                        <button
                          onClick={() => {
                            loadReportedReviews();
                            setCurrentPage("moderation");
                            setAccountMenuOpen(false);
                          }}
                          className="w-full flex items-center justify-between px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
                        >
                          <span className="flex items-center gap-2">
                            <Flag size={14} />
                            Moderation
                          </span>
                          {reportedReviews.length > 0 && (
                            <span className="px-1.5 py-0.5 text-xs rounded-full bg-red-100 text-red-700">
                              {reportedReviews.length}
                            </span>
                          )}
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setAccountMenuOpen(false);
                          logOut();
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
                      >
                        Log Out
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <button
                onClick={() => {
                  setAuthMode("login");
                  setCurrentPage("auth");
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 whitespace-nowrap"
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
          {selectedLandlord ? (
          <div className="flex gap-6">
            {/* Left Sidebar */}
            <div className="w-80 flex-shrink-0">
                  {/* Landlord Card */}
                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-6">
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
                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-6">
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
                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-6">
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
            </div>

            {/* Right Content */}
            <div className="flex-1">
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
                      <div
                        key={review.id}
                        className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-6"
                      >
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
                                          const editCountry = review.property?.country || "";
                                          const editState = review.property?.state || "";
                                          setEditingId(review.id);
                                          setLandlordName(review.property?.landlord?.name || "");
                                          setZipCode(review.property?.zipCode || "");
                                          setRating(review.rating);
                                          setComment(review.comment || "");
                                          setCity(review.property?.city || "");
                                          setState(editState);
                                          setCountry(editCountry);
                                          if (editCountry) {
                                            loadStates(editCountry, true);
                                          }
                                          if (editCountry && editState) {
                                            loadCities(editCountry, editState, true);
                                          }
                                          setTenantName(review.tenantName || "");
                                          const parsedTenure = parseTenure(review.tenure || "");
                                          setTenureStartMonth(parsedTenure.startMonth);
                                          setTenureStartYear(parsedTenure.startYear);
                                          setTenureEndMonth(parsedTenure.endMonth);
                                          setTenureEndYear(parsedTenure.endYear);
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
            </div>
          </div>
          ) : (
            <div>
              {/* Hero */}
              <div className="mb-10 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 text-white overflow-hidden">
                <div className="flex flex-col md:flex-row items-center gap-8 px-8 py-12">
                  <div className="flex-1 text-center md:text-left">
                    <h1 className="text-3xl md:text-4xl font-bold mb-3">
                      Know before you sign the lease
                    </h1>
                    <p className="text-blue-100 mb-6 max-w-md mx-auto md:mx-0">
                      Real tenants sharing real experiences with landlords and property
                      managers, so you know what you&apos;re getting into.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
                      <button
                        onClick={startWritingReview}
                        className="px-6 py-3 bg-white text-blue-700 rounded-lg font-semibold hover:bg-blue-50 transition-colors"
                      >
                        Write a Review
                      </button>
                      <button
                        onClick={scrollToBrowseGrid}
                        className="px-6 py-3 border border-white/60 text-white rounded-lg font-semibold hover:bg-white/10 transition-colors"
                      >
                        Browse Landlords
                      </button>
                    </div>
                  </div>
                  <Building2
                    size={140}
                    strokeWidth={1.25}
                    className="text-blue-300/50 flex-shrink-0 hidden md:block"
                  />
                </div>
              </div>

              <div ref={browseGridRef} className="mb-6 scroll-mt-6">
                <h2 className="text-2xl font-bold">Browse Landlords</h2>
                <p className="text-sm text-gray-600">
                  {landlords.length} landlord{landlords.length !== 1 ? "s" : ""} ·{" "}
                  {(reviews || []).length} review{(reviews || []).length !== 1 ? "s" : ""}
                </p>
              </div>

              {landlords.length === 0 && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-16 text-center text-gray-500">
                  No reviews yet. Be the first to write one.
                </div>
              )}

              {landlords.length > 0 && searchedLandlords.length === 0 && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-16 text-center text-gray-500">
                  No landlords match &quot;{searchQuery}&quot;.
                </div>
              )}

              {searchedLandlords.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {searchedLandlords.map((landlord) => {
                    const landlordReviews =
                      reviews?.filter((r) => r.property?.landlord?.name === landlord) || [];
                    const avg =
                      landlordReviews.length > 0
                        ? (
                            landlordReviews.reduce((sum, r) => sum + r.rating, 0) /
                            landlordReviews.length
                          ).toFixed(1)
                        : "0.0";
                    const avgNum = parseFloat(avg);
                    const ratingBadge =
                      avgNum >= 4
                        ? "bg-green-50 text-green-700"
                        : avgNum >= 2.5
                        ? "bg-yellow-50 text-yellow-700"
                        : "bg-red-50 text-red-700";

                    return (
                      <button
                        key={landlord}
                        onClick={() => setSelectedLandlord(landlord)}
                        className="text-left bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md hover:border-blue-300 transition-all"
                      >
                        <div className="flex items-start gap-3 mb-4">
                          <div
                            className={`w-11 h-11 rounded-lg ${getInitialsColor(
                              landlord
                            )} flex items-center justify-center text-white font-bold flex-shrink-0`}
                          >
                            {getInitials(landlord)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold truncate">{landlord}</p>
                            <p className="text-xs text-gray-500">
                              {landlordReviews.length} review
                              {landlordReviews.length !== 1 ? "s" : ""}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex gap-0.5">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                size={14}
                                className={
                                  i < Math.round(avgNum)
                                    ? "fill-yellow-400 text-yellow-400"
                                    : "text-gray-300"
                                }
                              />
                            ))}
                          </div>
                          <span
                            className={`text-xs font-bold px-2 py-1 rounded-full ${ratingBadge}`}
                          >
                            {avg}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
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

          <form onSubmit={submitReview} className="space-y-6 bg-white rounded-xl border border-gray-100 shadow-sm p-6">
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

            <div>
              <label className="block text-sm font-medium mb-2">Tenure</label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Start</p>
                  <div className="flex gap-2">
                    <div className="w-1/2">
                      <label className="block text-xs text-gray-500 mb-1">Month</label>
                      <select
                        value={tenureStartMonth}
                        onChange={(e) => setTenureStartMonth(e.target.value)}
                        className="border p-2 w-full rounded"
                      >
                        <option value="">Month</option>
                        {MONTH_OPTIONS.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="w-1/2">
                      <label className="block text-xs text-gray-500 mb-1">
                        Year <span className="text-red-600">*</span>
                      </label>
                      <select
                        value={tenureStartYear}
                        onChange={(e) => setTenureStartYear(e.target.value)}
                        className="border p-2 w-full rounded"
                      >
                        <option value="">Year</option>
                        {TENURE_YEARS.map((y) => (
                          <option key={y} value={y}>
                            {y}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">End</p>
                  <div className="flex gap-2">
                    <div className="w-1/2">
                      <label className="block text-xs text-gray-500 mb-1">Month</label>
                      <select
                        value={tenureEndMonth}
                        onChange={(e) => setTenureEndMonth(e.target.value)}
                        className="border p-2 w-full rounded"
                      >
                        <option value="">Month</option>
                        {MONTH_OPTIONS.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="w-1/2">
                      <label className="block text-xs text-gray-500 mb-1">
                        Year <span className="text-red-600">*</span>
                      </label>
                      <select
                        value={tenureEndYear}
                        onChange={(e) => setTenureEndYear(e.target.value)}
                        className="border p-2 w-full rounded"
                      >
                        <option value="">Year</option>
                        {TENURE_YEARS.map((y) => (
                          <option key={y} value={y}>
                            {y}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Whole section is optional, but a month without a year won&apos;t be saved.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                  disabled={loadingLocations || states.length === 0}
                  className="border p-2 w-full rounded disabled:bg-gray-100"
                >
                  <option value="">
                    {states.length === 0 ? "Select a country first" : "Select a state..."}
                  </option>
                  {states.map((s) => (
                    <option key={s.name} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">City</label>
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  disabled={loadingLocations || cities.length === 0}
                  className="border p-2 w-full rounded disabled:bg-gray-100"
                >
                  <option value="">
                    {cities.length === 0 ? "Select a state first" : "Select a city..."}
                  </option>
                  {cities.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

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
                  const rawFill = Math.min(Math.max(active - (star - 1), 0), 1);
                  const fillPercent = Math.round(rawFill * 100);

                  return (
                    <div
                      key={star}
                      className="relative w-10 h-10 cursor-pointer"
                      onMouseMove={(e: React.MouseEvent) => {
                        const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                        const isLeft = e.clientX < rect.left + rect.width / 2;
                        // Half stars are allowed everywhere except below 1 —
                        // the lower-left half of the first star still counts
                        // as a full 1, not 0.5.
                        setHoverRating(Math.max(1, isLeft ? star - 0.5 : star));
                      }}
                      onClick={() => setRating(Math.max(1, hoverRating || star))}
                    >
                      <Star size={40} className="text-gray-300" />
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
                    setTenureStartMonth("");
                    setTenureStartYear("");
                    setTenureEndMonth("");
                    setTenureEndYear("");
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
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8">
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

      {/* Moderation Page */}
      {currentPage === "moderation" && isAdmin && (
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold">Moderation Queue</h2>
              <p className="text-sm text-gray-600">
                Reported reviews — dismiss if there&apos;s no real problem, or remove them.
              </p>
            </div>
            <button onClick={goHome} className="text-blue-600 hover:text-blue-700 text-sm">
              ← Back
            </button>
          </div>

          {reportedReviews.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-16 text-center text-gray-500">
              Nothing reported right now.
            </div>
          ) : (
            <div className="space-y-4">
              {reportedReviews.map((review) => (
                <div
                  key={review.id}
                  className="bg-white rounded-xl border border-gray-100 shadow-sm p-6"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold">
                        {review.property?.landlord?.name}
                        <span className="text-gray-400 font-normal">
                          {" "}
                          · {review.showName === false ? "Anonymous" : review.tenantName}
                        </span>
                      </p>
                      <p className="text-xs text-gray-500">
                        {review.rating} stars ·{" "}
                        {new Date(review.createdAt || "").toLocaleDateString()}
                      </p>
                    </div>
                    <span className="text-xs font-bold px-2 py-1 rounded-full bg-red-50 text-red-700">
                      Reported
                    </span>
                  </div>
                  <p className="text-gray-700 mb-4">{review.comment}</p>
                  <div className="flex gap-2 pt-4 border-t">
                    <button
                      onClick={() => dismissReviewReport(review.id)}
                      className="px-4 py-2 border rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Dismiss report
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(review.id)}
                      className="px-4 py-2 rounded-lg text-sm bg-red-600 text-white hover:bg-red-700"
                    >
                      Remove review
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
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