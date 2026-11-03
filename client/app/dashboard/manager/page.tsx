"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
export default function ManagerDashboard() {
  const [name, setName] = useState("Manager");
  useEffect(() => { fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/api/auth/me`, { credentials: "include" }).then((r) => r.ok ? r.json() : Promise.reject()).then((result: { data: { name: string } }) => setName(result.data.name)).catch(() => { window.location.href = "/"; }); }, []);
  return <main className="dashboard-shell"><header className="dashboard-header"><div><p className="eyebrow warm">Manager workspace</p><h1>Welcome, {name}</h1><p>Update dishes and availability for today&apos;s service.</p></div><Link href="/" className="dashboard-link">View public menu ↗</Link></header><section className="dashboard-panel"><p className="eyebrow">Menu tools</p><h2>Your menu</h2><div className="tool-grid"><button>＋ Add menu item</button><button>☷ Edit menu items</button><button>◉ Update availability</button></div></section></main>;
}
