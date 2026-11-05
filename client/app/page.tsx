"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

// ── Types ────────────────────────────────────────────────────────────────────
type Category = { id: string; name: string };
type MenuItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string | null;
  isAvailable: boolean;
  category: { id: string; name: string };
};
type Restaurant = { id: string; name: string; logo: string | null; tagline: string | null };

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const PRICE_RANGES = ["All prices", "Under ₹200", "₹200 – ₹300", "Above ₹300"] as const;

// ── Emoji map (fallback when no image) ──────────────────────────────────────
const CATEGORY_EMOJI: Record<string, string> = {
  Burgers: "🍔", Pizza: "🍕", Sandwiches: "🥪",
  Juices: "🍹", Shakes: "🥤", Snacks: "🍟", Desserts: "🍰",
};
function itemEmoji(item: MenuItem) {
  return CATEGORY_EMOJI[item.category.name] ?? "🍽️";
}

// ── Icons ────────────────────────────────────────────────────────────────────
function SearchIcon() { return <span aria-hidden="true">⌕</span>; }
function UserIcon() { return <span aria-hidden="true">♙</span>; }

// ── Loading skeleton ─────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <article className="menu-card" style={{ opacity: 0.5, pointerEvents: "none" }}>
      <div className="food-image" style={{ background: "#ede7dd" }} />
      <div className="card-content">
        <div className="card-title">
          <div style={{ width: "60%", height: 16, background: "#ddd", borderRadius: 4 }} />
          <div style={{ width: 36, height: 14, background: "#ddd", borderRadius: 4 }} />
        </div>
        <div style={{ marginTop: 10, width: "90%", height: 10, background: "#eee", borderRadius: 4 }} />
        <div style={{ marginTop: 6, width: "70%", height: 10, background: "#eee", borderRadius: 4 }} />
      </div>
    </article>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function Home() {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [price, setPrice] = useState<string>("All prices");
  const [loginOpen, setLoginOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  // ── Fetch data from backend ────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      fetch(`${API}/api/restaurant`).then((r) => r.json() as Promise<{ data: Restaurant }>),
      fetch(`${API}/api/categories`).then((r) => r.json() as Promise<{ data: Category[] }>),
      fetch(`${API}/api/menu`).then((r) => r.json() as Promise<{ data: MenuItem[] }>),
    ])
      .then(([restaurantRes, categoriesRes, menuRes]) => {
        setRestaurant(restaurantRes.data ?? null);
        setCategories(Array.isArray(categoriesRes.data) ? categoriesRes.data : []);
        setMenuItems(Array.isArray(menuRes.data) ? menuRes.data : []);
      })
      .catch(() => setError("Could not connect to the server. Please try again."))
      .finally(() => setLoading(false));
  }, []);

  // ── Filtering ──────────────────────────────────────────────────────────────
  const categoryNames = useMemo(() => ["All", ...(categories ?? []).map((c) => c.name)], [categories]);

  const filteredItems = useMemo(() => {
    const q = query.toLowerCase();
    return (menuItems ?? []).filter((item) => {
      const matchesQuery = item.name.toLowerCase().includes(q) || item.description.toLowerCase().includes(q);
      const matchesCategory = category === "All" || item.category.name === category;
      const matchesPrice =
        price === "All prices" ||
        (price === "Under ₹200" && item.price < 200) ||
        (price === "₹200 – ₹300" && item.price >= 200 && item.price <= 300) ||
        (price === "Above ₹300" && item.price > 300);
      return matchesQuery && matchesCategory && matchesPrice;
    });
  }, [menuItems, category, price, query]);

  const visibleItems = showAll ? filteredItems : filteredItems.slice(0, 8);

  // ── Login ──────────────────────────────────────────────────────────────────
  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError(null);
    setLoginLoading(true);
    try {
      const form = new FormData(event.currentTarget);
      const response = await fetch(`${API}/api/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantCode: form.get("restaurantCode"),
          email: form.get("email"),
          phone: form.get("phone"),
          password: form.get("password"),
        }),
      });
      if (!response.ok) {
        setLoginError("Invalid login details. Please check your credentials.");
        return;
      }
      const result = (await response.json()) as { data: { redirectTo: string } };
      window.location.href = result.data.redirectTo;
    } catch {
      setLoginError("Could not connect to server. Is the backend running?");
    } finally {
      setLoginLoading(false);
    }
  }

  const restaurantName = restaurant?.name ?? "Tasty Corner";
  const restaurantTagline = restaurant?.tagline ?? "Freshly made, always worth it";

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <main className="site-shell">
      {/* ── Top bar ── */}
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark">{restaurantName.slice(0, 2).toUpperCase()}</div>
          <div>
            <p className="eyebrow">Welcome to</p>
            <h1>{restaurantName}</h1>
          </div>
        </div>
        <button className="owner-button" onClick={() => setLoginOpen(true)} aria-label="Open owner login">
          <UserIcon />
          <span>Owner login</span>
        </button>
      </header>

      {/* ── Menu section ── */}
      <section className="menu-section" aria-label="Restaurant menu">

        {/* ── Error banner ── */}
        {error && (
          <div
            style={{
              padding: "14px 18px",
              marginBottom: 20,
              background: "#fef2f2",
              border: "1px solid #fca5a5",
              borderRadius: 8,
              color: "#b91c1c",
              fontSize: 13,
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {/* ── Controls ── */}
        <div className="controls">
          <label className="search-box">
            <SearchIcon />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search dishes..."
              aria-label="Search dishes"
            />
            {query && (
              <button onClick={() => setQuery("")} aria-label="Clear search">
                ×
              </button>
            )}
          </label>
          <select
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            aria-label="Filter by price"
          >
            {PRICE_RANGES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </div>

        {/* ── Category pills ── */}
        <nav className="category-row" aria-label="Menu categories">
          {categoryNames.map((name) => (
            <button
              key={name}
              className={category === name ? "active" : ""}
              onClick={() => setCategory(name)}
            >
              {name}
            </button>
          ))}
        </nav>

        {/* ── Grid ── */}
        {loading ? (
          <div className="menu-grid">
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : visibleItems.length > 0 ? (
          <div className="menu-grid">
            {visibleItems.map((item) => (
              <article
                className={`menu-card ${!item.isAvailable ? "unavailable" : ""}`}
                key={item.id}
              >
                <div className="food-image">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt=""
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                        const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
                        if (fallback) fallback.style.display = "grid";
                      }}
                    />
                  ) : null}
                  <span
                    className="image-fallback"
                    style={{ display: item.imageUrl ? "none" : "grid" }}
                  >
                    {itemEmoji(item)}
                  </span>
                  {!item.isAvailable && <span className="sold-out">Unavailable</span>}
                </div>
                <div className="card-content">
                  <div className="card-title">
                    <h3>{item.name}</h3>
                    <strong>₹{item.price}</strong>
                  </div>
                  <p>{item.description}</p>
                  <div style={{ marginTop: 8 }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        background: "#f4efe7",
                        borderRadius: 99,
                        fontSize: 10,
                        color: "#847d74",
                        fontWeight: 600,
                        letterSpacing: "0.5px",
                        textTransform: "uppercase",
                      }}
                    >
                      {item.category.name}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <span>⌕</span>
            <h3>No dishes found</h3>
            <p>Try another search or category.</p>
          </div>
        )}

        {!loading && filteredItems.length > 8 && (
          <button className="load-more" onClick={() => setShowAll(!showAll)}>
            {showAll ? "Show less" : `View all ${filteredItems.length} dishes`}{" "}
            <span>{showAll ? "↑" : "↓"}</span>
          </button>
        )}
      </section>

      <footer>
        <span>Made with care at {restaurantName}</span>
        <span>Scan. Choose. Enjoy.</span>
      </footer>

      {/* ── Login modal ── */}
      {loginOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setLoginOpen(false);
          }}
        >
          <div className="login-modal" role="dialog" aria-modal="true" aria-labelledby="login-heading">
            <button
              className="close-button"
              onClick={() => setLoginOpen(false)}
              aria-label="Close login"
            >
              ×
            </button>
            <div className="modal-icon">{restaurantName.slice(0, 2).toUpperCase()}</div>
            <p className="eyebrow">{restaurantName} dashboard</p>
            <h2 id="login-heading">Welcome back</h2>
            <p className="modal-subtitle">Sign in to manage your menu.</p>

            {loginError && (
              <div
                style={{
                  padding: "10px 14px",
                  marginBottom: 12,
                  background: "#fef2f2",
                  border: "1px solid #fca5a5",
                  borderRadius: 7,
                  color: "#b91c1c",
                  fontSize: 12,
                }}
              >
                {loginError}
              </div>
            )}

            <form onSubmit={handleLogin}>
              <label>
                Restaurant code
                <input name="restaurantCode" required placeholder="e.g. TASTY001" />
              </label>
              <label>
                Email address
                <input name="email" type="email" required placeholder="you@example.com" />
              </label>
              <label>
                Phone number
                <input name="phone" required inputMode="numeric" placeholder="10-digit phone number" />
              </label>
              <label>
                Password
                <input name="password" required type="password" placeholder="••••••••" />
              </label>
              <button className="login-submit" type="submit" disabled={loginLoading}>
                {loginLoading ? "Signing in…" : "Sign in"} <span>→</span>
              </button>
            </form>
            <p className="demo-hint">Demo access: TASTY001 · owner@tastycorner.demo · 9876543210 · Owner@123</p>
          </div>
        </div>
      )}
    </main>
  );
}
