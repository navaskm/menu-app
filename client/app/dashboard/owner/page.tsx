"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
type User = { name: string; role: string };
export default function OwnerDashboard() {
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => { fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/api/auth/me`, { credentials: "include" }).then((r) => r.ok ? r.json() : Promise.reject()).then((result: { data: User }) => setUser(result.data)).catch(() => { window.location.href = "/"; }); }, []);
  return <main className="dashboard-shell"><header className="dashboard-header"><div><p className="eyebrow warm">Owner workspace</p><h1>Good morning, {user?.name ?? "Owner"}</h1><p>Keep your menu fresh and your service moving.</p></div><Link href="/" className="dashboard-link">View public menu ↗</Link></header><section className="dashboard-grid"><div className="stat-card"><span>Total menu items</span><strong>—</strong><small>Connect your database to view live totals</small></div><div className="stat-card"><span>Available today</span><strong>—</strong><small>Live availability overview</small></div><div className="stat-card"><span>Categories</span><strong>—</strong><small>Manage your menu structure</small></div><div className="stat-card"><span>Managers</span><strong>—</strong><small>Owner-only account management</small></div></section><section className="dashboard-panel"><p className="eyebrow">Owner tools</p><h2>Manage Tasty Corner</h2><div className="tool-grid"><button>＋ Add menu item</button><button>▦ Manage categories</button><button>♙ Manage managers</button></div></section></main>;
}
