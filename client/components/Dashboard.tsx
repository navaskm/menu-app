"use client";
import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { Plus, Edit2, Trash2, CheckCircle2, XCircle, ArrowLeft, LogOut, RefreshCw } from "lucide-react";

export type Role = "OWNER" | "MANAGER";

type User = { id: string; name: string; role: string; email: string; phone: string };
type Category = { id: string; name: string; description: string | null };
type MenuItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string | null;
  isAvailable: boolean;
  categoryId: string;
  category: { id: string; name: string };
};
type Manager = { id: string; name: string; email: string; phone: string; isActive: boolean; createdAt: string };

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface DashboardProps {
  role: Role;
}

export default function Dashboard({ role }: DashboardProps) {
  const isOwner = role === "OWNER";
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<"menu" | "categories" | "managers">("menu");

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);

  // Modal states
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);

  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);

  const [managerModalOpen, setManagerModalOpen] = useState(false);

  // Helper for auth headers
  const getHeaders = (hasBody = false): HeadersInit => {
    const token = typeof window !== "undefined" ? localStorage.getItem("tasty_token") : null;
    const h: Record<string, string> = {};
    if (token) h["Authorization"] = `Bearer ${token}`;
    if (hasBody) h["Content-Type"] = "application/json";
    return h;
  };

  // ── Initial Auth & Data Load ────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${API}/api/auth/me`, { credentials: "include", headers: getHeaders() })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((res: { data: User }) => {
        if (role === "OWNER" && res.data.role !== "OWNER") {
          window.location.href = "/dashboard/manager";
          return;
        }
        setUser(res.data);
        loadAllData();
      })
      .catch(() => {
        window.location.href = "/";
      });
  }, [role]);

  async function loadAllData() {
    setLoading(true);
    setActionError(null);
    try {
      const promises: [Promise<any>, Promise<any>, Promise<any>?] = [
        fetch(`${API}/api/menu`).then((r) => r.json()),
        fetch(`${API}/api/categories`).then((r) => r.json()),
      ];
      if (isOwner) {
        promises.push(
          fetch(`${API}/api/managers`, { credentials: "include", headers: getHeaders() }).then((r) => r.json())
        );
      }
      const [menuRes, catRes, manRes] = await Promise.all(promises);
      setMenuItems(Array.isArray(menuRes?.data) ? menuRes.data : []);
      setCategories(Array.isArray(catRes?.data) ? catRes.data : []);
      if (isOwner && manRes) {
        setManagers(Array.isArray(manRes.data) ? manRes.data : []);
      }
    } catch {
      setActionError("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }

  // ── Logout ──────────────────────────────────────────────────────────────────
  async function handleLogout() {
    try {
      await fetch(`${API}/api/auth/logout`, { method: "POST", credentials: "include", headers: getHeaders() });
    } catch {}
    localStorage.removeItem("tasty_token");
    window.location.href = "/";
  }

  // ── Menu Item Actions ───────────────────────────────────────────────────────
  async function handleSaveItem(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setActionError(null);
    const form = new FormData(e.currentTarget);
    const payload = {
      name: form.get("name") as string,
      categoryId: form.get("categoryId") as string,
      price: parseFloat(form.get("price") as string),
      description: form.get("description") as string,
      imageUrl: (form.get("imageUrl") as string)?.trim() || null,
      isAvailable: form.get("isAvailable") === "true",
    };

    try {
      const url = editingItem ? `${API}/api/menu/${editingItem.id}` : `${API}/api/menu`;
      const method = editingItem ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: getHeaders(true),
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        setActionError(err.error ?? "Failed to save menu item");
        return;
      }

      setItemModalOpen(false);
      setEditingItem(null);
      loadAllData();
    } catch {
      setActionError("An error occurred while saving the menu item");
    }
  }

  async function handleDeleteItem(id: string) {
    if (!confirm("Are you sure you want to delete this menu item?")) return;
    try {
      const res = await fetch(`${API}/api/menu/${id}`, {
        method: "DELETE",
        credentials: "include",
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error();
      loadAllData();
    } catch {
      setActionError("Failed to delete menu item");
    }
  }

  async function handleToggleAvailability(item: MenuItem) {
    try {
      const res = await fetch(`${API}/api/menu/${item.id}/availability`, {
        method: "PATCH",
        credentials: "include",
        headers: getHeaders(true),
        body: JSON.stringify({ isAvailable: !item.isAvailable }),
      });
      if (!res.ok) throw new Error();
      setMenuItems((prev) =>
        prev.map((m) => (m.id === item.id ? { ...m, isAvailable: !m.isAvailable } : m))
      );
    } catch {
      setActionError("Failed to toggle availability");
    }
  }

  // ── Category Actions ────────────────────────────────────────────────────────
  async function handleSaveCategory(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setActionError(null);
    const form = new FormData(e.currentTarget);
    const payload = {
      name: form.get("name") as string,
      description: (form.get("description") as string)?.trim() || null,
    };

    try {
      const url = editingCat ? `${API}/api/categories/${editingCat.id}` : `${API}/api/categories`;
      const method = editingCat ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: getHeaders(true),
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        setActionError(err.error ?? "Failed to save category");
        return;
      }

      setCatModalOpen(false);
      setEditingCat(null);
      loadAllData();
    } catch {
      setActionError("An error occurred while saving the category");
    }
  }

  async function handleDeleteCategory(id: string) {
    if (!confirm("Are you sure you want to delete this category?")) return;
    try {
      const res = await fetch(`${API}/api/categories/${id}`, {
        method: "DELETE",
        credentials: "include",
        headers: getHeaders(),
      });
      if (!res.ok) {
        const err = await res.json();
        setActionError(err.error ?? "Cannot delete category");
        return;
      }
      loadAllData();
    } catch {
      setActionError("Failed to delete category");
    }
  }

  // ── Manager Actions (Owner Only) ────────────────────────────────────────────
  async function handleSaveManager(e: FormEvent<HTMLFormElement>) {
    if (!isOwner) return;
    e.preventDefault();
    setActionError(null);
    const form = new FormData(e.currentTarget);
    const payload = {
      name: form.get("name") as string,
      email: form.get("email") as string,
      phone: form.get("phone") as string,
      password: form.get("password") as string,
    };

    try {
      const res = await fetch(`${API}/api/managers`, {
        method: "POST",
        credentials: "include",
        headers: getHeaders(true),
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        setActionError(err.error ?? "Failed to create manager");
        return;
      }

      setManagerModalOpen(false);
      loadAllData();
    } catch {
      setActionError("An error occurred while creating manager");
    }
  }

  async function handleToggleManagerStatus(man: Manager) {
    if (!isOwner) return;
    try {
      const res = await fetch(`${API}/api/managers/${man.id}/status`, {
        method: "PATCH",
        credentials: "include",
        headers: getHeaders(true),
        body: JSON.stringify({ isActive: !man.isActive }),
      });
      if (!res.ok) throw new Error();
      setManagers((prev) =>
        prev.map((m) => (m.id === man.id ? { ...m, isActive: !m.isActive } : m))
      );
    } catch {
      setActionError("Failed to update manager status");
    }
  }

  async function handleDeleteManager(id: string) {
    if (!isOwner) return;
    if (!confirm("Are you sure you want to delete this manager?")) return;
    try {
      const res = await fetch(`${API}/api/managers/${id}`, {
        method: "DELETE",
        credentials: "include",
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error();
      loadAllData();
    } catch {
      setActionError("Failed to delete manager");
    }
  }

  const availableCount = menuItems.filter((i) => i.isAvailable).length;
  const inputClass = "w-full rounded-[7px] border border-[#e5e1dc] p-3 text-[13px] text-[#292524] outline-none focus:border-[#e58b45]";

  return (
    <main className="min-h-screen bg-[#faf8f5] px-[clamp(20px,5vw,60px)] py-10">
      {/* Header */}
      <header className="mx-auto mb-8 flex max-w-[1180px] flex-wrap items-center justify-between gap-4 border-b border-[#e5e1dc] pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded px-2 py-[2px] text-[10px] font-bold uppercase tracking-wider text-white ${
                isOwner ? "bg-[#e58b45]" : "bg-[#6e8453]"
              }`}
            >
              {isOwner ? "Owner" : "Manager"}
            </span>
            <p
              className={`m-0 text-[11px] font-bold uppercase tracking-[1.5px] ${
                isOwner ? "text-[#e58b45]" : "text-[#6e8453]"
              }`}
            >
              Workspace
            </p>
          </div>
          <h1 className="m-0 text-[32px] font-bold tracking-tight text-[#292524] [font-family:Georgia,serif]">
            {isOwner ? `Welcome back, ${user?.name ?? "Owner"}` : `Welcome, ${user?.name ?? "Manager"}`}
          </h1>
          <p className="mt-1 text-[13px] text-[#78716c]">
            {isOwner
              ? "Manage dishes, categories, and managers for your restaurant."
              : "Update dishes, categories, and availability for today's service."}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1 rounded-full border border-[#e5e1dc] bg-white px-4 py-2 text-[12px] font-semibold text-[#292524] transition-colors hover:border-[#e58b45]"
          >
            <ArrowLeft size={14} /> View Public Menu
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-4 py-2 text-[12px] font-semibold text-red-600 transition-colors hover:bg-red-100"
          >
            <LogOut size={14} /> Logout
          </button>
        </div>
      </header>

      {/* Error alert */}
      {actionError && (
        <div className="mx-auto mb-6 max-w-[1180px] rounded-lg border border-red-200 bg-red-50 p-3 text-[13px] text-red-700 flex justify-between items-center">
          <span>⚠️ {actionError}</span>
          <button onClick={() => setActionError(null)} className="font-bold text-red-800">×</button>
        </div>
      )}

      {/* Stat Cards */}
      <section
        className={`mx-auto mb-8 grid max-w-[1180px] gap-4 ${
          isOwner ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-1 sm:grid-cols-3"
        }`}
      >
        <div className="rounded-[12px] border border-[#e5e1dc] bg-white p-5">
          <span className="text-[12px] text-[#78716c]">Total Menu Items</span>
          <strong className="my-1 block text-[32px] font-bold text-[#292524] [font-family:Georgia,serif]">{menuItems.length}</strong>
          <small className="text-[11px] text-[#78716c]">
            {isOwner ? "Dishes across all categories" : "Dishes in database"}
          </small>
        </div>
        <div className="rounded-[12px] border border-[#e5e1dc] bg-white p-5">
          <span className="text-[12px] text-[#78716c]">Available Today</span>
          <strong className="my-1 block text-[32px] font-bold text-[#6e8453] [font-family:Georgia,serif]">{availableCount}</strong>
          <small className="text-[11px] text-[#78716c]">{menuItems.length - availableCount} unavailable</small>
        </div>
        <div className="rounded-[12px] border border-[#e5e1dc] bg-white p-5">
          <span className="text-[12px] text-[#78716c]">Categories</span>
          <strong className="my-1 block text-[32px] font-bold text-[#e58b45] [font-family:Georgia,serif]">{categories.length}</strong>
          <small className="text-[11px] text-[#78716c]">
            {isOwner ? "Active food sections" : "Active sections"}
          </small>
        </div>
        {isOwner && (
          <div className="rounded-[12px] border border-[#e5e1dc] bg-white p-5">
            <span className="text-[12px] text-[#78716c]">Managers</span>
            <strong className="my-1 block text-[32px] font-bold text-[#292524] [font-family:Georgia,serif]">{managers.length}</strong>
            <small className="text-[11px] text-[#78716c]">Authorized staff accounts</small>
          </div>
        )}
      </section>

      {/* Tab Navigation */}
      <div className="mx-auto mb-6 flex max-w-[1180px] items-center justify-between border-b border-[#e5e1dc] pb-3">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("menu")}
            className={`rounded-full px-5 py-2 text-[13px] font-semibold transition-colors ${
              activeTab === "menu" ? "bg-[#292524] text-white" : "bg-white text-[#78716c] hover:bg-[#fff7ed]"
            }`}
          >
            Menu Items ({menuItems.length})
          </button>
          <button
            onClick={() => setActiveTab("categories")}
            className={`rounded-full px-5 py-2 text-[13px] font-semibold transition-colors ${
              activeTab === "categories" ? "bg-[#292524] text-white" : "bg-white text-[#78716c] hover:bg-[#fff7ed]"
            }`}
          >
            Categories ({categories.length})
          </button>
          {isOwner && (
            <button
              onClick={() => setActiveTab("managers")}
              className={`rounded-full px-5 py-2 text-[13px] font-semibold transition-colors ${
                activeTab === "managers" ? "bg-[#292524] text-white" : "bg-white text-[#78716c] hover:bg-[#fff7ed]"
              }`}
            >
              Managers ({managers.length})
            </button>
          )}
        </div>

        <div>
          {activeTab === "menu" && (
            <button
              onClick={() => { setEditingItem(null); setItemModalOpen(true); }}
              className="flex items-center gap-1.5 rounded-full bg-[#e58b45] px-4 py-2 text-[12px] font-bold text-white transition-colors hover:bg-[#d4793a]"
            >
              <Plus size={16} /> Add Menu Item
            </button>
          )}
          {activeTab === "categories" && (
            <button
              onClick={() => { setEditingCat(null); setCatModalOpen(true); }}
              className="flex items-center gap-1.5 rounded-full bg-[#e58b45] px-4 py-2 text-[12px] font-bold text-white transition-colors hover:bg-[#d4793a]"
            >
              <Plus size={16} /> Add Category
            </button>
          )}
          {isOwner && activeTab === "managers" && (
            <button
              onClick={() => setManagerModalOpen(true)}
              className="flex items-center gap-1.5 rounded-full bg-[#e58b45] px-4 py-2 text-[12px] font-bold text-white transition-colors hover:bg-[#d4793a]"
            >
              <Plus size={16} /> Add Manager
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="mx-auto max-w-[1180px]">
        {loading ? (
          <div className="py-20 text-center text-[#78716c] flex items-center justify-center gap-2">
            <RefreshCw className="animate-spin" size={18} /> Loading data...
          </div>
        ) : (
          <>
            {/* ── MENU ITEMS TAB ────────────────────────────────────────────── */}
            {activeTab === "menu" && (
              <div className="overflow-hidden rounded-[12px] border border-[#e5e1dc] bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[13px]">
                    <thead className="border-b border-[#e5e1dc] bg-[#faf8f5] text-[11px] font-bold uppercase tracking-wider text-[#78716c]">
                      <tr>
                        <th className="px-4 py-3.5">Dish</th>
                        <th className="px-4 py-3.5">Category</th>
                        <th className="px-4 py-3.5">Price</th>
                        <th className="px-4 py-3.5">Availability</th>
                        <th className="px-4 py-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e5e1dc]">
                      {menuItems.map((item) => (
                        <tr key={item.id} className="hover:bg-[#faf8f5] transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              {item.imageUrl ? (
                                <img src={item.imageUrl} alt="" className="h-10 w-10 rounded-md object-cover" />
                              ) : (
                                <div className="grid h-10 w-10 place-items-center rounded-md bg-[#faf8f5] text-lg">🍔</div>
                              )}
                              <div>
                                <span className="font-bold text-[#292524]">{item.name}</span>
                                <p className="line-clamp-1 text-[11px] text-[#78716c] max-w-[320px]">{item.description}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="rounded-full bg-[#faf8f5] px-2.5 py-1 text-[11px] font-medium text-[#78716c]">
                              {item.category?.name}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-bold text-[#e58b45]">₹{item.price}</td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => handleToggleAvailability(item)}
                              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                                item.isAvailable
                                  ? "bg-green-50 text-green-700 hover:bg-green-100"
                                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                              }`}
                            >
                              {item.isAvailable ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                              {item.isAvailable ? "Available" : "Unavailable"}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => { setEditingItem(item); setItemModalOpen(true); }}
                                className="rounded p-1.5 text-[#78716c] hover:bg-[#fff7ed] hover:text-[#e58b45]"
                                title="Edit"
                              >
                                <Edit2 size={15} />
                              </button>
                              <button
                                onClick={() => handleDeleteItem(item.id)}
                                className="rounded p-1.5 text-[#78716c] hover:bg-red-50 hover:text-red-600"
                                title="Delete"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {menuItems.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-[#78716c]">
                            No menu items yet. Click &quot;Add Menu Item&quot; to create your first dish!
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── CATEGORIES TAB ────────────────────────────────────────────── */}
            {activeTab === "categories" && (
              <div className="overflow-hidden rounded-[12px] border border-[#e5e1dc] bg-white shadow-sm">
                <table className="w-full text-left text-[13px]">
                  <thead className="border-b border-[#e5e1dc] bg-[#faf8f5] text-[11px] font-bold uppercase tracking-wider text-[#78716c]">
                    <tr>
                      <th className="px-4 py-3.5">Category Name</th>
                      <th className="px-4 py-3.5">Description</th>
                      <th className="px-4 py-3.5">Items in Category</th>
                      <th className="px-4 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e5e1dc]">
                    {categories.map((cat) => {
                      const count = menuItems.filter((m) => m.categoryId === cat.id).length;
                      return (
                        <tr key={cat.id} className="hover:bg-[#faf8f5] transition-colors">
                          <td className="px-4 py-3 font-bold text-[#292524]">{cat.name}</td>
                          <td className="px-4 py-3 text-[#78716c]">{cat.description || "—"}</td>
                          <td className="px-4 py-3">
                            <span className="rounded-full bg-[#faf8f5] px-2.5 py-1 text-[11px] font-semibold text-[#78716c]">
                              {count} {count === 1 ? "item" : "items"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => { setEditingCat(cat); setCatModalOpen(true); }}
                                className="rounded p-1.5 text-[#78716c] hover:bg-[#fff7ed] hover:text-[#e58b45]"
                                title="Edit"
                              >
                                <Edit2 size={15} />
                              </button>
                              <button
                                onClick={() => handleDeleteCategory(cat.id)}
                                className="rounded p-1.5 text-[#78716c] hover:bg-red-50 hover:text-red-600"
                                title="Delete"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {categories.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-12 text-center text-[#78716c]">
                          No categories yet. Click &quot;Add Category&quot; to get started.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── MANAGERS TAB (Owner Only) ─────────────────────────────────── */}
            {isOwner && activeTab === "managers" && (
              <div className="overflow-hidden rounded-[12px] border border-[#e5e1dc] bg-white shadow-sm">
                <table className="w-full text-left text-[13px]">
                  <thead className="border-b border-[#e5e1dc] bg-[#faf8f5] text-[11px] font-bold uppercase tracking-wider text-[#78716c]">
                    <tr>
                      <th className="px-4 py-3.5">Manager Name</th>
                      <th className="px-4 py-3.5">Email</th>
                      <th className="px-4 py-3.5">Phone</th>
                      <th className="px-4 py-3.5">Account Status</th>
                      <th className="px-4 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e5e1dc]">
                    {managers.map((man) => (
                      <tr key={man.id} className="hover:bg-[#faf8f5] transition-colors">
                        <td className="px-4 py-3 font-bold text-[#292524]">{man.name}</td>
                        <td className="px-4 py-3 text-[#78716c]">{man.email}</td>
                        <td className="px-4 py-3 text-[#78716c]">{man.phone}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleToggleManagerStatus(man)}
                            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                              man.isActive
                                ? "bg-green-50 text-green-700 hover:bg-green-100"
                                : "bg-red-50 text-red-700 hover:bg-red-100"
                            }`}
                          >
                            {man.isActive ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                            {man.isActive ? "Active" : "Inactive"}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleDeleteManager(man.id)}
                            className="rounded p-1.5 text-[#78716c] hover:bg-red-50 hover:text-red-600"
                            title="Delete"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {managers.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-[#78716c]">
                          No managers added yet. Click &quot;Add Manager&quot; to create a manager account.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── MODAL: ADD / EDIT MENU ITEM ──────────────────────────────────────── */}
      {itemModalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(32,27,21,0.67)] p-4 overflow-y-auto">
          <div className="relative w-full max-w-[500px] rounded-[14px] bg-white p-6 shadow-xl my-8">
            <button
              onClick={() => { setItemModalOpen(false); setEditingItem(null); }}
              className="absolute right-4 top-4 text-xl text-[#78716c]"
            >
              ×
            </button>
            <h2 className="mb-4 text-xl font-bold [font-family:Georgia,serif]">
              {editingItem ? "Edit Menu Item" : "Add Menu Item"}
            </h2>
            <form onSubmit={handleSaveItem} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-[#292524]">Item Name</label>
                <input
                  name="name"
                  required
                  defaultValue={editingItem?.name ?? ""}
                  placeholder={isOwner ? "e.g. Malabar Chicken Pizza" : "e.g. Smoky Chicken Burger"}
                  className={inputClass}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-[#292524]">Category</label>
                  <select name="categoryId" required defaultValue={editingItem?.categoryId ?? categories[0]?.id} className={inputClass}>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#292524]">Price (₹)</label>
                  <input
                    name="price"
                    type="number"
                    step="1"
                    required
                    defaultValue={editingItem?.price ?? ""}
                    placeholder={isOwner ? "250" : "220"}
                    className={inputClass}
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#292524]">Description</label>
                <textarea
                  name="description"
                  rows={3}
                  required
                  defaultValue={editingItem?.description ?? ""}
                  placeholder="Describe ingredients, taste, etc."
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#292524]">Image URL (optional)</label>
                <input
                  name="imageUrl"
                  defaultValue={editingItem?.imageUrl ?? ""}
                  placeholder="https://images.unsplash.com/..."
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#292524]">Availability</label>
                <select name="isAvailable" defaultValue={editingItem ? String(editingItem.isAvailable) : "true"} className={inputClass}>
                  <option value="true">Available</option>
                  <option value="false">Unavailable / Sold Out</option>
                </select>
              </div>
              <div className="mt-4 flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setItemModalOpen(false); setEditingItem(null); }}
                  className="rounded-lg border border-[#e5e1dc] px-4 py-2 text-[12px] font-semibold text-[#78716c]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#e58b45] px-5 py-2 text-[12px] font-bold text-white hover:bg-[#d4793a]"
                >
                  {editingItem ? "Update Item" : "Create Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: ADD / EDIT CATEGORY ───────────────────────────────────────── */}
      {catModalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(32,27,21,0.67)] p-4">
          <div className="relative w-full max-w-[420px] rounded-[14px] bg-white p-6 shadow-xl">
            <button
              onClick={() => { setCatModalOpen(false); setEditingCat(null); }}
              className="absolute right-4 top-4 text-xl text-[#78716c]"
            >
              ×
            </button>
            <h2 className="mb-4 text-xl font-bold [font-family:Georgia,serif]">
              {editingCat ? "Edit Category" : "Add Category"}
            </h2>
            <form onSubmit={handleSaveCategory} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-[#292524]">Category Name</label>
                <input
                  name="name"
                  required
                  defaultValue={editingCat?.name ?? ""}
                  placeholder={isOwner ? "e.g. Beverages" : "e.g. Desserts"}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#292524]">Description (optional)</label>
                <input
                  name="description"
                  defaultValue={editingCat?.description ?? ""}
                  placeholder={isOwner ? "e.g. Refreshing cold & hot drinks" : "e.g. Delicious sweet treats"}
                  className={inputClass}
                />
              </div>
              <div className="mt-4 flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setCatModalOpen(false); setEditingCat(null); }}
                  className="rounded-lg border border-[#e5e1dc] px-4 py-2 text-[12px] font-semibold text-[#78716c]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#e58b45] px-5 py-2 text-[12px] font-bold text-white hover:bg-[#d4793a]"
                >
                  {editingCat ? "Update Category" : "Create Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: ADD MANAGER (Owner Only) ─────────────────────────────────── */}
      {isOwner && managerModalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(32,27,21,0.67)] p-4">
          <div className="relative w-full max-w-[420px] rounded-[14px] bg-white p-6 shadow-xl">
            <button
              onClick={() => setManagerModalOpen(false)}
              className="absolute right-4 top-4 text-xl text-[#78716c]"
            >
              ×
            </button>
            <h2 className="mb-4 text-xl font-bold [font-family:Georgia,serif]">Add New Manager</h2>
            <form onSubmit={handleSaveManager} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-[#292524]">Full Name</label>
                <input name="name" required placeholder="e.g. John Doe" className={inputClass} />
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#292524]">Email Address</label>
                <input name="email" type="email" required placeholder="manager@example.com" className={inputClass} />
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#292524]">Phone Number (10 digits)</label>
                <input name="phone" required placeholder="9876543210" className={inputClass} />
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#292524]">Password</label>
                <input name="password" type="password" required placeholder="••••••••" className={inputClass} />
              </div>
              <div className="mt-4 flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setManagerModalOpen(false)}
                  className="rounded-lg border border-[#e5e1dc] px-4 py-2 text-[12px] font-semibold text-[#78716c]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#e58b45] px-5 py-2 text-[12px] font-bold text-white hover:bg-[#d4793a]"
                >
                  Create Manager
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
