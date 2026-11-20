"use client";
import { useEffect, useState, useRef, FormEvent, ChangeEvent } from "react";
import Link from "next/link";
import { Plus, Edit2, Trash2, CheckCircle2, XCircle, ArrowLeft, LogOut, RefreshCw, X, Camera, Upload } from "lucide-react";

export type Role = "OWNER" | "MANAGER";

type User = { id: string; name: string; role: string; email: string; phone: string };
type Category = { id: string; name: string; description: string | null };
type MenuItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string | null;
  imageKey?: string | null;
  isAvailable: boolean;
  categoryId: string;
  category: { id: string; name: string };
};
type Manager = { id: string; name: string; email: string; phone: string; password?: string; createdAt: string };

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const DATA_CHANGE_KEY = "tasty-data-change";

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
  const [savingItem, setSavingItem] = useState(false);
  const [savingCategory, setSavingCategory] = useState(false);
  const [savingManager, setSavingManager] = useState(false);

  // Modal states
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string>("");
  const [uploadedImageKey, setUploadedImageKey] = useState<string>("");
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);

  const [managerModalOpen, setManagerModalOpen] = useState(false);
  const [editingManager, setEditingManager] = useState<Manager | null>(null);

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

  // Keep other open dashboard tabs in sync without reloading this page.
  useEffect(() => {
    function handleDataChange(event: StorageEvent) {
      if (event.key === DATA_CHANGE_KEY) loadAllData();
    }

    window.addEventListener("storage", handleDataChange);
    return () => window.removeEventListener("storage", handleDataChange);
  }, [role]);

  function broadcastDataChange() {
    localStorage.setItem(DATA_CHANGE_KEY, String(Date.now()));
  }

  // ── Logout ──────────────────────────────────────────────────────────────────
  async function handleLogout() {
    try {
      await fetch(`${API}/api/auth/logout`, { method: "POST", credentials: "include", headers: getHeaders() });
    } catch { }
    localStorage.removeItem("tasty_token");
    window.location.href = "/";
  }

  function openAddItemModal() {
    setEditingItem(null);
    setUploadedImageUrl("");
    setUploadedImageKey("");
    setPendingImageFile(null);
    setUploadError(null);
    setItemModalOpen(true);
  }

  function openEditItemModal(item: MenuItem) {
    setEditingItem(item);
    setUploadedImageUrl(item.imageUrl ?? "");
    setUploadedImageKey(item.imageKey ?? "");
    setPendingImageFile(null);
    setUploadError(null);
    setItemModalOpen(true);
  }

  function closeItemModal() {
    setItemModalOpen(false);
    setEditingItem(null);
    setUploadedImageUrl("");
    setUploadedImageKey("");
    setPendingImageFile(null);
    setUploadError(null);
  }

  async function handleImageFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setUploadError("Please select a valid image file (JPG, PNG, WebP).");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Image size must be less than 5MB.");
      return;
    }

    setUploadError(null);
    setPendingImageFile(file);
    setUploadedImageUrl(URL.createObjectURL(file));
    setUploadedImageKey("");
    e.target.value = "";
  }

  // ── Menu Item Actions ───────────────────────────────────────────────────────
  async function handleSaveItem(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setActionError(null);
    const form = new FormData(e.currentTarget);
    if (!uploadedImageUrl && !pendingImageFile) {
      setActionError("Please add a dish image (take photo or upload).");
      return;
    }

    try {
      setSavingItem(true);
      let imageUrl = uploadedImageUrl || (form.get("imageUrl") as string)?.trim();
      let imageKey = uploadedImageKey || (form.get("imageKey") as string)?.trim() || null;

      if (pendingImageFile) {
        setUploadingImage(true);
        const data = new FormData();
        data.append("file", pendingImageFile);
        const token = typeof window !== "undefined" ? localStorage.getItem("tasty_token") : null;
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const uploadRes = await fetch(`${API}/api/uploads`, {
          method: "POST",
          credentials: "include",
          headers,
          body: data,
        });
        const uploadJson = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(uploadJson.error ?? "Failed to upload image");
        imageUrl = uploadJson.data.url;
        imageKey = uploadJson.data.key || null;
      }

      const payload = {
        name: form.get("name") as string,
        categoryId: form.get("categoryId") as string,
        price: parseFloat(form.get("price") as string),
        description: form.get("description") as string,
        imageUrl,
        imageKey,
        isAvailable: form.get("isAvailable") === "true",
      };

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

      const result = (await res.json()) as { data: MenuItem };
      setMenuItems((prev) =>
        editingItem
          ? prev.map((item) => (item.id === editingItem.id ? result.data : item))
          : [result.data, ...prev],
      );
      closeItemModal();
      broadcastDataChange();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "An error occurred while saving the menu item");
    } finally {
      setUploadingImage(false);
      setSavingItem(false);
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
      setMenuItems((prev) => prev.filter((item) => item.id !== id));
      broadcastDataChange();
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
      const result = (await res.json()) as { data: { isAvailable: boolean } };
      setMenuItems((prev) =>
        prev.map((m) => (m.id === item.id ? { ...m, isAvailable: result.data.isAvailable } : m)),
      );
      broadcastDataChange();
    } catch {
      setActionError("Failed to toggle availability");
    }
  }

  // ── Category Actions ────────────────────────────────────────────────────────
  async function handleSaveCategory(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setActionError(null);
    const form = new FormData(e.currentTarget);
    const desc = form.get("description");
    const payload = {
      name: form.get("name") as string,
      description: typeof desc === "string" && desc.trim() ? desc.trim() : (editingCat?.description ?? null),
    };

    try {
      setSavingCategory(true);
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

      const result = (await res.json()) as { data: Category };
      setCategories((prev) =>
        editingCat
          ? prev.map((category) => (category.id === editingCat.id ? result.data : category))
          : [result.data, ...prev],
      );
      if (editingCat && editingCat.name !== result.data.name) {
        setMenuItems((prev) =>
          prev.map((item) =>
            item.categoryId === result.data.id
              ? { ...item, category: { ...item.category, name: result.data.name } }
              : item,
          ),
        );
      }
      setCatModalOpen(false);
      setEditingCat(null);
      broadcastDataChange();
    } catch {
      setActionError("An error occurred while saving the category");
    } finally {
      setSavingCategory(false);
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
      setCategories((prev) => prev.filter((category) => category.id !== id));
      broadcastDataChange();
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

    try {
      setSavingManager(true);
      if (editingManager) {
        const payload = {
          name: (form.get("name") as string)?.trim() ?? "",
          email: (form.get("email") as string)?.trim(),
          phone: (form.get("phone") as string)?.trim(),
          password: (form.get("password") as string)?.trim() ?? "",
        };

        const res = await fetch(`${API}/api/managers/${editingManager.id}`, {
          method: "PUT",
          credentials: "include",
          headers: getHeaders(true),
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const err = await res.json();
          setActionError(err.error ?? "Failed to update manager");
          return;
        }
        const result = (await res.json()) as { data: Manager };
        setManagers((prev) => prev.map((manager) => (manager.id === editingManager.id ? result.data : manager)));
      } else {
        const payload = {
          email: (form.get("email") as string)?.trim(),
          phone: (form.get("phone") as string)?.trim(),
        };

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
        const result = (await res.json()) as { data: Manager };
        setManagers((prev) => [result.data, ...prev]);
      }

      setManagerModalOpen(false);
      setEditingManager(null);
      broadcastDataChange();
    } catch {
      setActionError("An error occurred while saving manager");
    } finally {
      setSavingManager(false);
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
      setManagers((prev) => prev.filter((manager) => manager.id !== id));
      broadcastDataChange();
    } catch {
      setActionError("Failed to delete manager");
    }
  }

  const availableCount = menuItems.filter((i) => i.isAvailable).length;
  const inputClass = "w-full rounded-[7px] border border-[#e5e1dc] p-3 text-[13px] text-[#292524] outline-none focus:border-[#e58b45]";

  return (
    <main className="min-h-screen bg-[#faf8f5] px-[clamp(20px,5vw,60px)] max-w-[2000px] py-3">
      {/* Header */}
      <header className="relative mb-8 border-b border-[#e5e1dc] pb-6">

        {/* Top row: Role + Actions */}
        <div className="mb-4 flex items-center justify-between gap-2 md:mb-2">

          {/* Role badge */}
          <span
            className={`shrink-0 rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white ${isOwner ? "bg-[#e58b45]" : "bg-[#6e8453]"
              }`}
          >
            {isOwner ? "Owner" : "Manager"}
          </span>

          {/* Actions: Top right */}
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="flex items-center gap-1.5 rounded-full border border-[#e5e1dc] bg-white px-3 py-2 text-[11px] font-semibold text-[#292524] transition-colors hover:border-[#e58b45] hover:bg-[#fff7ed] md:px-4 md:text-[12px]"
            >
              <ArrowLeft size={14} />
              <span className="max-[380px]:hidden">Public Menu</span>
              <span className="min-[381px]:hidden">Menu</span>
            </Link>

            <button
              onClick={handleLogout}
              className="flex items-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-medium text-[#a8a29e] transition-colors hover:bg-red-50 hover:text-red-600 md:text-[12px]"
            >
              <LogOut size={13} />
              Logout
            </button>
          </div>
        </div>

        {/* Greeting */}
        <div>
          <p className="mb-1 text-[11px] font-medium text-[#a8a29e]">
            Restaurant Dashboard
          </p>

          <h1 className="m-0 text-[26px] font-bold tracking-tight text-[#292524] [font-family:Georgia,serif] md:text-[34px]">
            Hi, {user?.name ?? "Manager"}
          </h1>

          <p className="mt-1 text-[13px] leading-relaxed text-[#78716c]">
            {isOwner
              ? "Manage dishes, categories, and managers for your restaurant."
              : "Update dishes, categories, and availability for today's service."}
          </p>
        </div>

      </header>

      {/* Error alert */}
      {actionError && (
        <div className="mx-auto mb-6 rounded-lg border border-red-200 bg-red-50 p-3 text-[13px] text-red-700 flex justify-between items-center">
          <span>⚠️ {actionError}</span>
          <button onClick={() => setActionError(null)} className="font-bold text-red-800">×</button>
        </div>
      )}

      {/* Stat Cards */}
      <section
        className="mx-auto mb-8 grid gap-4 grid-cols-2 sm:grid-cols-4"
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
      <div className="mx-auto mb-6 border-b border-[#e5e1dc] pb-3">

        {/* Tabs */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

          <div className="flex w-full gap-2 overflow-x-auto pb-1 scrollbar-hide sm:w-auto sm:pb-0">
            <button
              onClick={() => setActiveTab("menu")}
              className={`shrink-0 rounded-full px-4 py-2 text-[12px] font-semibold transition-colors sm:px-5 sm:text-[13px] ${activeTab === "menu"
                ? "bg-[#292524] text-white"
                : "bg-white text-[#78716c] hover:bg-[#fff7ed]"
                }`}
            >
              Menu Items ({menuItems.length})
            </button>

            <button
              onClick={() => setActiveTab("categories")}
              className={`shrink-0 rounded-full px-4 py-2 text-[12px] font-semibold transition-colors sm:px-5 sm:text-[13px] ${activeTab === "categories"
                ? "bg-[#292524] text-white"
                : "bg-white text-[#78716c] hover:bg-[#fff7ed]"
                }`}
            >
              Categories ({categories.length})
            </button>

            {isOwner && (
              <button
                onClick={() => setActiveTab("managers")}
                className={`shrink-0 rounded-full px-4 py-2 text-[12px] font-semibold transition-colors sm:px-5 sm:text-[13px] ${activeTab === "managers"
                  ? "bg-[#292524] text-white"
                  : "bg-white text-[#78716c] hover:bg-[#fff7ed]"
                  }`}
              >
                Managers ({managers.length})
              </button>
            )}
          </div>

          {/* Action Buttons */}
          <div className="w-full shrink-0 sm:w-auto">

            {activeTab === "menu" && (
              <button
                onClick={openAddItemModal}
                className="flex w-full items-center justify-center gap-1.5 rounded-full bg-[#e58b45] px-4 py-2.5 text-[12px] font-bold text-white transition-colors hover:bg-[#d4793a] sm:w-auto"
              >
                <Plus size={16} /> Add Menu Item
              </button>
            )}

            {activeTab === "categories" && (
              <button
                onClick={() => {
                  setEditingCat(null);
                  setCatModalOpen(true);
                }}
                className="flex w-full items-center justify-center gap-1.5 rounded-full bg-[#e58b45] px-4 py-2.5 text-[12px] font-bold text-white transition-colors hover:bg-[#d4793a] sm:w-auto"
              >
                <Plus size={16} /> Add Category
              </button>
            )}

            {isOwner && activeTab === "managers" && (
              <button
                onClick={() => {
                  setEditingManager(null);
                  setManagerModalOpen(true);
                }}
                className="flex w-full items-center justify-center gap-1.5 rounded-full bg-[#e58b45] px-4 py-2.5 text-[12px] font-bold text-white transition-colors hover:bg-[#d4793a] sm:w-auto"
              >
                <Plus size={16} /> Add Manager
              </button>
            )}

          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="mx-auto">
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
                              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${item.isAvailable
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
                                onClick={() => openEditItemModal(item)}
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
                <div className="w-full overflow-x-auto">
                  <table className="w-full min-w-[450px] text-left text-[13px]">
                    <thead className="border-b border-[#e5e1dc] bg-[#faf8f5] text-[11px] font-bold uppercase tracking-wider text-[#78716c]">
                      <tr>
                        <th className="px-4 py-3.5">Category Name</th>
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
                          <td colSpan={3} className="py-12 text-center text-[#78716c]">
                            No categories yet. Click &quot;Add Category&quot; to get started.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── MANAGERS TAB (Owner Only) ─────────────────────────────────── */}
            {isOwner && activeTab === "managers" && (
              <div className="overflow-hidden rounded-[12px] border border-[#e5e1dc] bg-white shadow-sm">
                <div className="w-full overflow-x-auto">
                  <table className="w-full min-w-[750px] text-left text-[13px]">
                    <thead className="border-b border-[#e5e1dc] bg-[#faf8f5] text-[11px] font-bold uppercase tracking-wider text-[#78716c]">
                      <tr>
                        <th className="px-4 py-3.5">Manager Name</th>
                        <th className="px-4 py-3.5">Email</th>
                        <th className="px-4 py-3.5">Phone</th>
                        <th className="px-4 py-3.5">Password</th>
                        <th className="px-4 py-3.5 text-right">Actions</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-[#e5e1dc]">
                      {managers.map((man) => (
                        <tr key={man.id} className="transition-colors hover:bg-[#faf8f5]">
                          <td className="px-4 py-3 font-bold text-[#292524]">
                            {man.name || "—"}
                          </td>

                          <td className="px-4 py-3 text-[#78716c]">
                            {man.email}
                          </td>

                          <td className="px-4 py-3 text-[#78716c]">
                            {man.phone}
                          </td>

                          <td className="px-4 py-3 font-mono text-[12px] text-[#292524]">
                            {man.password || "—"}
                          </td>

                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => {
                                  setEditingManager(man);
                                  setManagerModalOpen(true);
                                }}
                                className="rounded p-1.5 text-[#78716c] hover:bg-[#fff7ed] hover:text-[#e58b45]"
                                title="Edit"
                              >
                                <Edit2 size={15} />
                              </button>
                              <button
                                onClick={() => handleDeleteManager(man.id)}
                                className="rounded p-1.5 text-[#78716c] hover:bg-red-50 hover:text-red-600"
                                title="Delete"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
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
              type="button"
              onClick={closeItemModal}
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-[#faf8f5] text-[#78716c] transition-all hover:bg-red-50 hover:text-red-600"
              aria-label="Close modal"
            >
              <X size={20} strokeWidth={2.2} />
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

              {/* ── Dish Image (Required: Take photo on phone or Upload) ── */}
              <div>
                <label className="text-[11px] font-bold text-[#292524]">
                  Dish Image <span className="text-red-500">*</span>
                </label>

                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleImageFileChange}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageFileChange}
                />

                <input type="hidden" name="imageUrl" value={uploadedImageUrl} />
                <input type="hidden" name="imageKey" value={uploadedImageKey} />

                <div className="mt-1.5 space-y-2">
                  {uploadedImageUrl ? (
                    <div className="relative h-40 w-full overflow-hidden rounded-[8px] border border-[#e5e1dc] bg-[#faf8f5]">
                      <img
                        src={uploadedImageUrl}
                        alt="Dish preview"
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setUploadedImageUrl("");
                          setUploadedImageKey("");
                          setPendingImageFile(null);
                        }}
                        className="absolute right-2 top-2 rounded-full bg-[rgba(0,0,0,0.6)] px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-black"
                      >
                        Change
                      </button>
                    </div>
                  ) : null}

                  {uploadingImage && (
                    <div className="flex items-center justify-center gap-2 rounded-[8px] border border-[#e5e1dc] bg-[#faf8f5] py-4 text-[12px] font-semibold text-[#e58b45]">
                      <RefreshCw className="animate-spin" size={16} /> Uploading image...
                    </div>
                  )}

                  {uploadError && (
                    <p className="text-[11px] text-red-600">⚠️ {uploadError}</p>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={uploadingImage}
                      onClick={() => cameraInputRef.current?.click()}
                      className="flex items-center justify-center gap-1.5 rounded-[7px] border border-[#e5e1dc] bg-white py-2.5 text-[12px] font-bold text-[#292524] transition-colors hover:border-[#e58b45] hover:bg-[#fff7ed] disabled:opacity-50"
                    >
                      <Camera size={15} className="text-[#e58b45]" /> Take photo (phone)
                    </button>

                    <button
                      type="button"
                      disabled={uploadingImage}
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center justify-center gap-1.5 rounded-[7px] border border-[#e5e1dc] bg-white py-2.5 text-[12px] font-bold text-[#292524] transition-colors hover:border-[#e58b45] hover:bg-[#fff7ed] disabled:opacity-50"
                    >
                      <Upload size={15} className="text-[#e58b45]" /> Upload image
                    </button>
                  </div>
                  {!uploadedImageUrl && (
                    <p className="text-[11px] text-[#78716c]">
                      Please take a photo with your phone or upload an image file (JPG, PNG, WebP).
                    </p>
                  )}
                </div>
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
                  onClick={closeItemModal}
                  disabled={savingItem}
                  className="rounded-lg border border-[#e5e1dc] px-4 py-2 text-[12px] font-semibold text-[#78716c]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadingImage || savingItem}
                  className="flex min-w-[118px] items-center justify-center gap-2 rounded-lg bg-[#e58b45] px-5 py-2 text-[12px] font-bold text-white hover:bg-[#d4793a] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingItem && <RefreshCw className="animate-spin" size={14} />}
                  {savingItem ? (editingItem ? "Updating..." : "Creating...") : (editingItem ? "Update Item" : "Create Item")}
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
              type="button"
              onClick={() => {
                setCatModalOpen(false);
                setEditingCat(null);
              }}
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-[#faf8f5] text-[#78716c] transition-all hover:bg-red-50 hover:text-red-600"
              aria-label="Close modal"
            >
              <X size={20} strokeWidth={2.2} />
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
              <div className="mt-4 flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={savingCategory}
                  onClick={() => { setCatModalOpen(false); setEditingCat(null); }}
                  className="rounded-lg border border-[#e5e1dc] px-4 py-2 text-[12px] font-semibold text-[#78716c] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCategory}
                  className="flex min-w-[145px] items-center justify-center gap-2 rounded-lg bg-[#e58b45] px-5 py-2 text-[12px] font-bold text-white hover:bg-[#d4793a] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingCategory && <RefreshCw className="animate-spin" size={14} />}
                  {savingCategory ? (editingCat ? "Updating..." : "Creating...") : (editingCat ? "Update Category" : "Create Category")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: ADD / EDIT MANAGER (Owner Only) ───────────────────────────── */}
      {isOwner && managerModalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(32,27,21,0.67)] p-4">
          <div className="relative w-full max-w-[420px] rounded-[14px] bg-white p-6 shadow-xl">
            <button
              type="button"
              onClick={() => {
                setManagerModalOpen(false);
                setEditingManager(null);
              }}
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-[#faf8f5] text-[#78716c] transition-all hover:bg-red-50 hover:text-red-600"
              aria-label="Close modal"
            >
              <X size={20} strokeWidth={2.2} />
            </button>
            <h2 className="mb-4 text-xl font-bold [font-family:Georgia,serif]">
              {editingManager ? "Edit Manager" : "Add New Manager"}
            </h2>
            <form onSubmit={handleSaveManager} className="space-y-3">
              {editingManager && (
                <div>
                  <label className="text-[11px] font-bold text-[#292524]">Full Name</label>
                  <input
                    name="name"
                    defaultValue={editingManager.name ?? ""}
                    placeholder="e.g. John Doe"
                    className={inputClass}
                  />
                </div>
              )}
              <div>
                <label className="text-[11px] font-bold text-[#292524]">Email Address</label>
                <input
                  name="email"
                  type="email"
                  required
                  defaultValue={editingManager?.email ?? ""}
                  placeholder="manager@example.com"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#292524]">Phone Number (10 digits)</label>
                <input
                  name="phone"
                  required
                  defaultValue={editingManager?.phone ?? ""}
                  placeholder="9876543210"
                  className={inputClass}
                />
              </div>
              {editingManager && (
                <div>
                  <label className="text-[11px] font-bold text-[#292524]">Password</label>
                  <input
                    name="password"
                    defaultValue={editingManager.password ?? ""}
                    placeholder="••••••••"
                    className={inputClass}
                  />
                </div>
              )}
              <div className="mt-4 flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={savingManager}
                  onClick={() => {
                    setManagerModalOpen(false);
                    setEditingManager(null);
                  }}
                  className="rounded-lg border border-[#e5e1dc] px-4 py-2 text-[12px] font-semibold text-[#78716c] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingManager}
                  className="flex min-w-[145px] items-center justify-center gap-2 rounded-lg bg-[#e58b45] px-5 py-2 text-[12px] font-bold text-white hover:bg-[#d4793a] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingManager && <RefreshCw className="animate-spin" size={14} />}
                  {savingManager ? (editingManager ? "Updating..." : "Creating...") : (editingManager ? "Update Manager" : "Create Manager")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
