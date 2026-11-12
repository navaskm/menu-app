"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

type User = { name: string; role: string };

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const STATS = [
  { label: "Total menu items",  note: "Connect your database to view live totals" },
  { label: "Available today",   note: "Live availability overview" },
  { label: "Categories",        note: "Manage your menu structure" },
  { label: "Managers",          note: "Owner-only account management" },
];

const TOOLS = ["＋ Add menu item", "▦ Manage categories", "♙ Manage managers"];

export default function OwnerDashboard() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    fetch(`${API}/api/auth/me`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((result: { data: User }) => setUser(result.data))
      .catch(() => { window.location.href = "/"; });
  }, []);

  return (
    <main className="min-h-screen bg-[#faf8f5] px-[clamp(20px,6vw,100px)] py-12">

      {/* Header */}
      <header className="mx-auto mb-[38px] flex max-w-[1120px] flex-wrap items-end justify-between gap-4">
        <div>
          <p className="m-0 mb-[5px] text-[10px] font-bold uppercase tracking-[1.7px] text-[#e58b45]">
            Owner workspace
          </p>
          <h1 className="m-0 text-[clamp(32px,5vw,54px)] font-bold tracking-[-1.5px] [font-family:Georgia,serif]">
            Good morning, {user?.name ?? "Owner"}
          </h1>
          <p className="mb-0 mt-1 text-[14px] text-[#78716c]">
            Keep your menu fresh and your service moving.
          </p>
        </div>
        <Link
          href="/"
          className="text-[12px] font-bold text-[#e58b45] no-underline hover:underline"
        >
          View public menu ↗
        </Link>
      </header>

      {/* Stats grid — 1 col → 2 col → 4 col */}
      <section className="mx-auto mb-0 grid max-w-[1120px] grid-cols-1 gap-[14px] sm:grid-cols-2 lg:grid-cols-4">
        {STATS.map((stat) => (
          <div
            key={stat.label}
            className="rounded-[12px] border border-[#e5e1dc] bg-white p-[22px]"
          >
            <span className="block text-[12px] text-[#78716c]">{stat.label}</span>
            <strong className="my-2 block text-[35px] font-bold [font-family:Georgia,serif]">—</strong>
            <small className="text-[10px] text-[#78716c]">{stat.note}</small>
          </div>
        ))}
      </section>

      {/* Tools panel */}
      <section className="mx-auto mt-7 max-w-[1120px] rounded-[12px] border border-[#e5e1dc] bg-white p-[22px]">
        <p className="m-0 mb-[5px] text-[10px] font-bold uppercase tracking-[1.7px] text-[#78716c]">
          Owner tools
        </p>
        <h2 className="mb-[22px] mt-0 text-[28px] font-bold [font-family:Georgia,serif]">
          Manage Tasty Corner
        </h2>
        {/* Tool buttons — 1 col → 3 col */}
        <div className="grid grid-cols-1 gap-[14px] sm:grid-cols-3">
          {TOOLS.map((tool) => (
            <button
              key={tool}
              className="cursor-pointer rounded-[8px] border border-[#e5e1dc] bg-white p-4 text-left text-[12px] text-[#292524] transition-colors hover:border-[#e58b45] hover:text-[#e58b45]"
            >
              {tool}
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
