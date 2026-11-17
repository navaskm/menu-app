"use client";
import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
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
type AuthUser = { id: string; name: string; role: "OWNER" | "MANAGER"; email: string; phone: string };

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const PRICE_RANGES = ["All prices", "Under ₹200", "₹200 – ₹300", "Above ₹300"] as const;

// ── Skeleton card ─────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <article className="min-w-0 overflow-hidden rounded-[10px] border border-[#e5e1dc] bg-white opacity-50 pointer-events-none">
      <div className="h-[166px] bg-[#ede7dd] max-[620px]:h-[128px]" />
      <div className="p-[13px] pb-[15px] max-[620px]:p-[10px]">
        <div className="flex items-start justify-between gap-1 mb-[10px]">
          <div className="h-4 w-[60%] rounded bg-[#ddd]" />
          <div className="h-[14px] w-9 rounded bg-[#ddd]" />
        </div>
        <div className="h-[10px] w-[90%] rounded bg-[#eee] mb-[6px]" />
        <div className="h-[10px] w-[70%] rounded bg-[#eee]" />
      </div>
    </article>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
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
  const [showPassword, setShowPassword] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  // ── Persistent Auth Check ──────────────────────────────────────────────────
  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("tasty_token") : null;
    const headers: HeadersInit = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    fetch(`${API}/api/auth/me`, { credentials: "include", headers })
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (res?.data) {
          setCurrentUser(res.data);
        } else {
          setCurrentUser(null);
        }
      })
      .catch(() => setCurrentUser(null));
  }, []);

  // ── Fetch Menu & Categories ────────────────────────────────────────────────
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
      .catch(() => setError("Could not connect to the server. Please check that the backend is running."))
      .finally(() => setLoading(false));
  }, []);

  // ── Filtering ──────────────────────────────────────────────────────────────
  const categoryNames = useMemo(
    () => ["All", ...(categories ?? []).map((c) => c.name)],
    [categories],
  );

  const filteredItems = useMemo(() => {
    const q = query.toLowerCase();
    return (menuItems ?? []).filter((item) => {
      const matchesQuery =
        item.name.toLowerCase().includes(q) || item.description.toLowerCase().includes(q);
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
          name: form.get("name"),
          email: form.get("email"),
          phone: form.get("phone"),
          password: form.get("password"),
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        setLoginError(result.error ?? "Invalid login details. Please check your credentials.");
        return;
      }

      if (result.data?.token) {
        localStorage.setItem("tasty_token", result.data.token);
      }
      if (result.data?.user) {
        setCurrentUser(result.data.user);
      }
      setLoginOpen(false);
      window.location.href = result.data.redirectTo;
    } catch {
      setLoginError("Could not connect to server. Is the backend running?");
    } finally {
      setLoginLoading(false);
    }
  }

  // ── Logout ─────────────────────────────────────────────────────────────────
  async function handleLogout() {
    const token = typeof window !== "undefined" ? localStorage.getItem("tasty_token") : null;
    const headers: HeadersInit = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    try {
      await fetch(`${API}/api/auth/logout`, { method: "POST", credentials: "include", headers });
    } catch {}
    localStorage.removeItem("tasty_token");
    setCurrentUser(null);
  }

  const restaurantName = restaurant?.name ?? "Tasty Corner";
  const initials = restaurantName.slice(0, 2).toUpperCase();

  const inputCls =
    "mt-[6px] block w-full rounded-[7px] border border-[#e5e1dc] p-3 text-[13px] text-[#292524] outline-none transition-colors focus:border-[#e58b45]";

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1320px] overflow-x-hidden bg-white">

      {/* ── Topbar ── */}
      <header className="flex h-[86px] items-center justify-between border-b border-[#e5e1dc] px-[clamp(20px,5vw,76px)] max-[620px]:h-[72px]">
        <div className="flex items-center gap-[11px]">
          <div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-[#e58b45] text-[13px] font-bold tracking-[0.5px] text-white [font-family:Georgia,serif] max-[620px]:h-9 max-[620px]:w-9">
            {initials}
          </div>
          <div>
            <p className="m-0 mb-[5px] text-[10px] font-bold uppercase tracking-[1.7px] text-[#78716c]">
              Welcome to
            </p>
            <h1 className="m-0 text-[22px] font-bold [font-family:Georgia,serif] max-[620px]:text-[19px]">
              {restaurantName}
            </h1>
          </div>
        </div>

        {/* ── User Auth State in Header ── */}
        {currentUser ? (
          <div className="flex items-center gap-2">
            <Link
              href={currentUser.role === "OWNER" ? "/dashboard/owner" : "/dashboard/manager"}
              className="flex cursor-pointer items-center gap-2 rounded-full border border-[#e58b45] bg-[#fff7ed] px-[14px] py-[10px] text-[12px] font-bold text-[#e58b45] transition-colors hover:bg-[#e58b45] hover:text-white max-[620px]:px-[11px] max-[620px]:py-2"
            >
              <span>Dashboard ({currentUser.role === "OWNER" ? "Owner" : "Manager"})</span>
              <span aria-hidden="true">↗</span>
            </Link>
            <button
              onClick={handleLogout}
              className="cursor-pointer rounded-full border border-[#e5e1dc] bg-transparent px-3 py-[10px] text-[12px] text-[#78716c] hover:border-[#292524] hover:text-[#292524] max-[620px]:px-2 max-[620px]:py-2"
              title="Logout"
            >
              Logout
            </button>
          </div>
        ) : (
          <button
            className="flex cursor-pointer items-center gap-2 rounded-full border border-[#e5e1dc] bg-transparent px-[14px] py-[10px] text-[12px] text-[#292524] transition-colors hover:border-[#e58b45] max-[620px]:px-[11px] max-[620px]:py-2"
            onClick={() => setLoginOpen(true)}
            aria-label="Open login"
          >
            <span aria-hidden="true" className="text-[20px] leading-[12px]">♙</span>
            <span className="max-[620px]:hidden">Owner / Manager login</span>
          </button>
        )}
      </header>

      {/* ── Menu section ── */}
      <section className="px-[clamp(20px,5vw,76px)] pb-[60px] pt-[52px] max-[620px]:pt-[38px]" aria-label="Restaurant menu">

        {/* Section heading */}
        <div className="mb-[25px] flex items-end justify-between max-[620px]:items-center">
          <div>
            <p className="m-0 mb-[5px] text-[10px] font-bold uppercase tracking-[1.7px] text-[#78716c]">Our menu</p>
            <h2 className="m-0 text-[31px] font-bold tracking-[-0.8px] [font-family:Georgia,serif] max-[620px]:text-[27px]">
              What are you craving?
            </h2>
          </div>
          <span className="flex items-center text-[11px] font-bold text-[#6e8453]">
            <span className="mr-[6px] inline-block h-[7px] w-[7px] rounded-full bg-[#86a56b] max-[620px]:mr-0" aria-hidden="true" />
            <span className="max-[620px]:hidden">Open now</span>
          </span>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-5 rounded-lg border border-[#fca5a5] bg-[#fef2f2] px-[18px] py-[14px] text-[13px] text-[#b91c1c]">
            ⚠️ {error}
          </div>
        )}

        {/* Search + price filter */}
        <div className="mb-[18px] flex gap-[10px] max-[620px]:gap-[7px]">
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-[#e5e1dc] bg-white px-3 text-[#78716c]">
            <span aria-hidden="true" className="inline-block shrink-0 rotate-[-20deg] text-[25px] leading-none">⌕</span>
            <input
              className="w-full border-0 bg-transparent px-[2px] py-[13px] text-[13px] text-[#292524] outline-none placeholder:text-[#78716c]"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search dishes..."
              aria-label="Search dishes"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="cursor-pointer border-0 bg-transparent p-0 text-[19px] leading-none text-[#78716c]"
              >
                ×
              </button>
            )}
          </label>
          <select
            className="cursor-pointer rounded-lg border border-[#e5e1dc] bg-white px-[10px] py-[12px] text-[12px] text-[#78716c] outline-none min-w-[125px] max-[620px]:min-w-[95px] max-[620px]:text-[11px]"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            aria-label="Filter by price"
          >
            {PRICE_RANGES.map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>

        {/* Category pills */}
        <nav
          className="no-scrollbar mb-0 flex gap-2 overflow-x-auto pb-[28px] max-[620px]:pb-[21px]"
          aria-label="Menu categories"
        >
          {categoryNames.map((name) => (
            <button
              key={name}
              onClick={() => setCategory(name)}
              className={`shrink-0 cursor-pointer whitespace-nowrap rounded-full border px-[15px] py-[9px] text-[12px] transition-colors ${category === name
                ? "border-[#292524] bg-[#292524] text-white"
                : "border-[#e5e1dc] bg-white text-[#78716c] hover:border-[#e58b45] hover:bg-[#fff7ed]"
                }`}
            >
              {name}
            </button>
          ))}
        </nav>

        {/* Menu grid */}
        {loading ? (
          <div className="grid grid-cols-4 gap-x-[16px] gap-y-[22px] max-[900px]:grid-cols-3 max-[620px]:grid-cols-2 max-[620px]:gap-x-[10px] max-[620px]:gap-y-[15px]">
            {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : visibleItems.length > 0 ? (
          <div className="grid grid-cols-4 gap-x-[16px] gap-y-[22px] max-[900px]:grid-cols-3 max-[620px]:grid-cols-2 max-[620px]:gap-x-[10px] max-[620px]:gap-y-[15px]">
            {visibleItems.map((item) => (
              <article
                key={item.id}
                className="min-w-0 overflow-hidden rounded-[10px] border border-[#e5e1dc] bg-white transition-all duration-200 hover:-translate-y-[3px] hover:shadow-[0_10px_25px_rgba(61,45,28,0.07)]"
              >
                {/* Image */}
                <div className="relative h-[166px] overflow-hidden bg-[#f1e9de] max-[620px]:h-[128px]">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      loading="lazy"
                      className={`block h-full w-full object-cover ${!item.isAvailable ? "[filter:grayscale(0.75)] opacity-60" : ""}`}
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                        const fb = e.currentTarget.nextElementSibling as HTMLElement | null;
                        if (fb) fb.style.display = "flex";
                      }}
                    />
                  ) : null}
                  <span
                    className="absolute inset-0 flex items-center justify-center text-[48px] bg-[#f7f4ef]"
                    style={{ display: item.imageUrl ? "none" : "flex" }}
                  >
                    🍽️
                  </span>
                  {/* Unavailable badge */}
                  {!item.isAvailable && (
                    <span className="absolute left-[10px] top-[10px] rounded bg-[rgba(57,51,45,0.79)] px-2 py-[5px] text-[10px] font-bold text-white">
                      Unavailable
                    </span>
                  )}
                </div>

                {/* Card body */}
                <div className="p-[13px] pb-[15px] max-[620px]:p-[10px]">
                  <div className="flex items-start justify-between gap-1">
                    <h3 className="m-0 text-[16px] font-bold leading-[1.15] [font-family:Georgia,serif] max-[620px]:text-[14px]">
                      {item.name}
                    </h3>
                    <strong className="shrink-0 whitespace-nowrap text-[13px] font-bold text-[#e58b45] max-[620px]:text-[12px]">
                      ₹{item.price}
                    </strong>
                  </div>
                  <p className="mb-0 mt-[9px] min-h-[42px] text-[11px] leading-[1.45] text-[#78716c] max-[620px]:min-h-[44px] max-[620px]:text-[10px]">
                    {item.description}
                  </p>
                  <div className="mt-2">
                    <span className="inline-block rounded-full bg-[#f4efe7] px-2 py-[2px] text-[10px] font-semibold uppercase tracking-[0.5px] text-[#78716c]">
                      {item.category?.name}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          /* Empty state */
          <div className="border border-dashed border-[#e5e1dc] px-[20px] py-[50px] text-center text-[#78716c]">
            <span className="block text-[34px]">⌕</span>
            <h3 className="mt-[10px] mb-1 text-[20px] font-bold text-[#292524] [font-family:Georgia,serif]">
              No dishes found
            </h3>
            <p className="m-0 text-[13px]">Try another search or category.</p>
          </div>
        )}

        {/* Load more */}
        {!loading && filteredItems.length > 8 && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="mx-auto mt-[34px] block cursor-pointer rounded-full border border-[#292524] bg-white px-[18px] py-3 text-[12px] text-[#292524] transition-colors hover:bg-[#292524] hover:text-white"
          >
            {showAll ? "Show less" : `View all ${filteredItems.length} dishes`}
            <span className="ml-[7px]">{showAll ? "↑" : "↓"}</span>
          </button>
        )}
      </section>

      {/* ── Footer ── */}
      <footer className="flex justify-between px-[clamp(20px,5vw,76px)] py-5 bg-[#f4efe7] text-[10px] tracking-[0.5px] text-[#9b9185] max-[620px]:flex-col max-[620px]:gap-[6px]">
        <span>Made with care at {restaurantName}</span>
        <span>Scan. Choose. Enjoy.</span>
      </footer>

      {/* ── Login modal ── */}
      {loginOpen && (
        <div
          className="fixed inset-0 z-20 grid place-items-center p-5 bg-[rgba(32,27,21,0.67)]"
          role="presentation"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setLoginOpen(false); }}
        >
          <div
            className="relative w-full max-w-[400px] rounded-[14px] bg-white p-8 shadow-[0_25px_80px_rgba(0,0,0,0.2)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="login-heading"
          >
            {/* Close */}
            <button
              onClick={() => setLoginOpen(false)}
              aria-label="Close login"
              className="absolute right-[18px] top-[17px] cursor-pointer border-0 bg-transparent p-0 text-[25px] leading-none text-[#78716c]"
            >
              ×
            </button>

            {/* Modal icon */}
            <div className="mb-[19px] flex h-[42px] w-[42px] items-center justify-center rounded-full bg-[#e58b45] text-[13px] font-bold tracking-[0.5px] text-white [font-family:Georgia,serif]">
              {initials}
            </div>

            <p className="m-0 mb-[5px] text-[10px] font-bold uppercase tracking-[1.7px] text-[#78716c]">
              Tasty Corner Dashboard
            </p>
            <h2 id="login-heading" className="m-0 text-[29px] font-bold [font-family:Georgia,serif]">
              Welcome back
            </h2>
            <p className="mb-[25px] mt-[7px] text-[13px] text-[#78716c]">
              Sign in with your Name, Email, Phone and Password.
            </p>

            {/* Login error */}
            {loginError && (
              <div className="mb-3 rounded-[7px] border border-[#fca5a5] bg-[#fef2f2] px-[14px] py-[10px] text-[12px] text-[#b91c1c]">
                {loginError}
              </div>
            )}

            <form onSubmit={handleLogin} className="grid gap-[14px]">
              <label className="text-[11px] font-bold text-[#292524]">
                Name
                <input name="name" required placeholder="e.g. Demo Owner" className={inputCls} />
              </label>
              <label className="text-[11px] font-bold text-[#292524]">
                Email address
                <input name="email" type="email" required placeholder="owner@tastycorner.demo" className={inputCls} />
              </label>
              <label className="text-[11px] font-bold text-[#292524]">
                Phone number
                <input name="phone" required inputMode="numeric" placeholder="9876543210" className={inputCls} />
              </label>
              <label className="text-[11px] font-bold text-[#292524]">
                Password
                <div className="relative">
                  <input
                    name="password"
                    required
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className={`${inputCls} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-[#78716c] transition-colors hover:text-[#292524]"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </label>
              <button
                type="submit"
                disabled={loginLoading}
                className="mt-[5px] flex cursor-pointer items-center justify-between rounded-[7px] border-0 bg-[#e58b45] px-[15px] py-[13px] text-[12px] font-bold text-white transition-colors hover:bg-[#d4793a] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loginLoading ? "Signing in…" : "Sign in"} <span>→</span>
              </button>
            </form>

            <div className="mt-4 border-t border-[#e5e1dc] pt-3 text-[11px] text-[#78716c]">
              <p className="m-0 font-bold text-[#292524]">Demo Credentials:</p>
              <p className="m-0 mt-1">Owner: Demo Owner · owner@tastycorner.demo · 9876543210 · Owner@123</p>
              <p className="m-0 mt-1">Manager: Demo Manager One · manager1@tastycorner.demo · 9876543211 · Manager@123</p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
