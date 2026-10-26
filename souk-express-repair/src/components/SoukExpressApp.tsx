"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  ShoppingBag,
  Search,
  MapPin,
  Star,
  Clock,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  Smartphone,
  MessageCircle,
  Bike,
  Store,
  ShieldCheck,
  User,
  LogOut,
  Award,
  Tag,
  ArrowRight,
  Package,
  XCircle,
  Globe,
} from "lucide-react";
import { translations, type Lang } from "@/lib/i18n";
import {
  AndroidInstallModal,
  AuthModal,
  ProductDetailModal,
  type ProductDetailItem,
} from "./PwaModals";
import { DriverPortal } from "./DriverPortal";
import { PartnerPortal } from "./PartnerPortal";
import { AdminPortal } from "./AdminPortal";

interface AuthUser {
  id: number;
  email: string;
  phone: string;
  fullName: string;
  role: "customer" | "driver" | "partner" | "admin";
  driverCode: string | null;
  vehiclePlate: string | null;
  isOnline: boolean;
  currentZone: string | null;
}

interface DemoAccount {
  id: number;
  email: string;
  fullName: string;
  role: "customer" | "driver" | "partner" | "admin";
  driverCode: string | null;
  vehiclePlate: string | null;
  isOnline: boolean;
  currentZone: string | null;
  phone: string;
}

interface ServiceZone {
  id: number;
  nameFr: string;
  nameAr: string;
  slug: string;
  deliveryFeeMad: number;
  driverPayoutMad: number;
  estimatedMins: string;
}

interface ShopItem {
  id: number;
  ownerId: number;
  nameFr: string;
  nameAr: string;
  category: string;
  descriptionFr: string;
  descriptionAr: string;
  imageUrl: string;
  address: string;
  zoneId: number | null;
  phone: string;
  commissionRate: number;
  prepTimeMins: string;
  rating: string;
  isApproved: boolean;
  isOpen: boolean;
}

interface PromoItem {
  id: number;
  code: string;
  titleFr: string;
  titleAr: string;
  discountMad: number;
  minOrderMad: number;
}

interface LoyaltyRecord {
  stampsCount: number;
  pointsBalance: number;
  totalOrdersCompleted: number;
  rewardsRedeemed: number;
}

interface CustomerOrder {
  id: number;
  orderNumber: string;
  status: string;
  subtotalMad: number;
  deliveryFeeMad: number;
  discountMad: number;
  totalMad: number;
  deliveryAddressSnapshot: string;
  deliveryZoneSnapshot: string;
  shopNameSnapshot: string;
  shopPhoneSnapshot: string;
  orderNotes: string;
  rejectionReason: string | null;
  paymentStatus: string;
  createdAt: string;
  items: Array<{
    id: number;
    productNameFrSnapshot: string;
    productNameArSnapshot: string;
    unitPriceMadSnapshot: number;
    quantity: number;
    lineTotalMad: number;
  }>;
  driverInfo: {
    id: number;
    fullName: string;
    phone: string;
    driverCode: string | null;
    vehiclePlate: string | null;
  } | null;
}

export function SoukExpressApp() {
  const [lang, setLang] = useState<Lang>("fr");
  const t = translations[lang];
  const isRtl = lang === "ar";

  // Auth & Role state
  const [user, setUser] = useState<AuthUser | null>(null);
  const [demoAccounts, setDemoAccounts] = useState<DemoAccount[]>([]);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // PWA install modal
  const [installModalOpen, setInstallModalOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<unknown>(null);

  // Customer navigation tab
  const [customerView, setCustomerView] = useState<
    "home" | "cart" | "orders"
  >("home");

  // Catalog state
  const [zones, setZones] = useState<ServiceZone[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<number>(1);
  const [shops, setShops] = useState<ShopItem[]>([]);
  const [selectedShopId, setSelectedShopId] = useState<number | null>(null);
  const [products, setProducts] = useState<ProductDetailItem[]>([]);
  const [promotions, setPromotions] = useState<PromoItem[]>([]);
  const [loyalty, setLoyalty] = useState<LoyaltyRecord | null>(null);

  // Search & filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [detailProduct, setDetailProduct] = useState<ProductDetailItem | null>(
    null
  );

  // Cart & Checkout state
  const [cart, setCart] = useState<
    Array<{ product: ProductDetailItem; quantity: number }>
  >([]);
  const [deliveryAddress, setDeliveryAddress] = useState(
    "Imm. Atlas, Appt 8, Avenue Hassan II, Talborjt"
  );
  const [deliveryLandmark, setDeliveryLandmark] = useState(
    "En face du Jardin Olhão, près Pharmacie Centrale"
  );
  const [customerPhone, setCustomerPhone] = useState("+212668445566");
  const [orderNotes, setOrderNotes] = useState("");
  const [promoCodeInput, setPromoCodeInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<PromoItem | null>(null);
  const [redeemTenStamps, setRedeemTenStamps] = useState(false);
  const [checkoutIdempotencyKey, setCheckoutIdempotencyKey] = useState(() =>
    `se-chk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [checkoutBanner, setCheckoutBanner] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Customer Orders
  const [customerOrders, setCustomerOrders] = useState<CustomerOrder[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);

  // Register PWA Service Worker & listen for Android install prompt
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Ignore service worker registration errors in dev
      });
    }
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const loadAll = useCallback(async () => {
    setLoadingCatalog(true);
    try {
      const authRes = await fetch("/api/auth");
      let currentUser: AuthUser | null = null;
      if (authRes.ok) {
        const authData = await authRes.json();
        currentUser = authData.user;
        const accounts: DemoAccount[] = authData.demoAccounts || [];
        setDemoAccounts(accounts);

        // If no user session yet, auto-sign in as first demo Customer (Salma) so beginner can immediately browse & order!
        if (!currentUser && accounts.length > 0) {
          const defaultCustomer =
            accounts.find((a) => a.role === "customer") || accounts[0]!;
          const swRes = await fetch("/api/auth", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "switch_demo_user",
              userId: defaultCustomer.id,
            }),
          });
          if (swRes.ok) {
            const swData = await swRes.json();
            currentUser = swData.user;
          }
        }
        setUser(currentUser);
        if (currentUser?.phone) {
          setCustomerPhone(currentUser.phone);
        }
      }

      const catRes = await fetch("/api/catalog");
      if (catRes.ok) {
        const catData = await catRes.json();
        const zList: ServiceZone[] = catData.zones || [];
        setZones(zList);
        if (zList.length > 0) {
          setSelectedZoneId((prev) =>
            zList.some((z) => z.id === prev) ? prev : zList[0]!.id
          );
        }
        setShops(catData.shops || []);
        setProducts(catData.products || []);
        setPromotions(catData.promotions || []);
        setLoyalty(catData.loyalty || null);
        if (catData.addresses && catData.addresses.length > 0) {
          const defAddr = catData.addresses[0];
          setDeliveryAddress(defAddr.streetAddress);
          setDeliveryLandmark(defAddr.landmark || "");
          if (defAddr.zoneId) setSelectedZoneId(defAddr.zoneId);
        }
      }

      if (currentUser && currentUser.role === "customer") {
        const ordRes = await fetch("/api/orders");
        if (ordRes.ok) {
          const ordData = await ordRes.json();
          setCustomerOrders(ordData.orders || []);
        }
      }
    } finally {
      setLoadingCatalog(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function handleSwitchAccount(targetUserId: number) {
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "switch_demo_user",
        userId: targetUserId,
      }),
    });
    if (res.ok) {
      await loadAll();
    }
  }

  async function handleLogout() {
    await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    });
    setUser(null);
    setAuthModalOpen(true);
  }

  // Cart manipulation (single-shop per order for clean motorcycle dispatch)
  function handleAddToCart(product: ProductDetailItem, qty = 1) {
    if (!product.isAvailable) return;
    setCart((prev) => {
      // Check if cart has items from another shop
      if (prev.length > 0 && prev[0]!.product.shopId !== product.shopId) {
        // Replace with new shop's item and notify
        setCheckoutBanner({
          type: "success",
          text: "Nouveau panier créé pour ce commerce d'Agadir.",
        });
        setTimeout(() => setCheckoutBanner(null), 3000);
        return [{ product, quantity: qty }];
      }
      const existingIdx = prev.findIndex((i) => i.product.id === product.id);
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = {
          product,
          quantity: updated[existingIdx]!.quantity + qty,
        };
        return updated;
      }
      return [...prev, { product, quantity: qty }];
    });
    // Regenerate idempotency key when cart changes
    setCheckoutIdempotencyKey(
      `se-chk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    );
  }

  function handleUpdateCartQty(productId: number, delta: number) {
    setCart((prev) =>
      prev
        .map((item) =>
          item.product.id === productId
            ? { ...item, quantity: item.quantity + delta }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
    setCheckoutIdempotencyKey(
      `se-chk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    );
  }

  // Filtered shops & products
  const filteredShops = useMemo(() => {
    return shops.filter((sh) => {
      if (selectedCategory !== "all" && sh.category !== selectedCategory) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        sh.nameFr.toLowerCase().includes(q) ||
        sh.nameAr.includes(q) ||
        sh.descriptionFr.toLowerCase().includes(q)
      );
    });
  }, [shops, selectedCategory, searchQuery]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (selectedShopId && p.shopId !== selectedShopId) return false;
      if (selectedCategory !== "all") {
        const parentShop = shops.find((s) => s.id === p.shopId);
        if (parentShop && parentShop.category !== selectedCategory) {
          return false;
        }
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        p.nameFr.toLowerCase().includes(q) ||
        p.nameAr.includes(q) ||
        p.descriptionFr.toLowerCase().includes(q) ||
        p.categoryFr.toLowerCase().includes(q)
      );
    });
  }, [products, selectedShopId, selectedCategory, searchQuery, shops]);

  const activeZone =
    zones.find((z) => z.id === selectedZoneId) ?? zones[0] ?? null;

  // Cart totals preview (Server calculates authoritative total on submit)
  const cartSubtotalMad = cart.reduce(
    (sum, item) => sum + item.product.priceMad * item.quantity,
    0
  );
  const deliveryFeeMad = activeZone ? activeZone.deliveryFeeMad : 15;

  let discountMad = 0;
  if (appliedPromo && cartSubtotalMad >= appliedPromo.minOrderMad) {
    discountMad += appliedPromo.discountMad;
  }
  if (redeemTenStamps && (loyalty?.stampsCount ?? 0) >= 10) {
    discountMad += 25;
  }
  discountMad = Math.min(discountMad, cartSubtotalMad + deliveryFeeMad);
  const cartTotalMad = Math.max(
    0,
    cartSubtotalMad + deliveryFeeMad - discountMad
  );
  const cartItemsCount = cart.reduce((s, i) => s + i.quantity, 0);

  function handleApplyPromoCode() {
    const code = promoCodeInput.trim().toUpperCase();
    const found = promotions.find((p) => p.code === code);
    if (!found) {
      setCheckoutBanner({
        type: "error",
        text: "Code promo introuvable ou expiré.",
      });
      return;
    }
    if (cartSubtotalMad < found.minOrderMad) {
      setCheckoutBanner({
        type: "error",
        text: `Ce code nécessite un sous-total minimum de ${found.minOrderMad} MAD.`,
      });
      return;
    }
    setAppliedPromo(found);
    setCheckoutBanner({
      type: "success",
      text: `Code ${found.code} appliqué (-${found.discountMad} MAD) !`,
    });
  }

  async function handleCheckoutSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (cart.length === 0 || submittingOrder) return;

    setSubmittingOrder(true);
    setCheckoutBanner(null);

    try {
      const shopId = cart[0]!.product.shopId;
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: checkoutIdempotencyKey,
          shopId,
          zoneId: activeZone?.id ?? 1,
          deliveryAddress,
          deliveryLandmark,
          customerPhone,
          orderNotes,
          promoCode: appliedPromo?.code || "",
          redeemLoyaltyTenStamps: redeemTenStamps,
          items: cart.map((i) => ({
            productId: i.product.id,
            quantity: i.quantity,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setCheckoutBanner({
          type: "error",
          text: data.error || "Erreur lors de la validation de commande.",
        });
      } else {
        setCart([]);
        setAppliedPromo(null);
        setRedeemTenStamps(false);
        setOrderNotes("");
        setCheckoutIdempotencyKey(
          `se-chk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        );
        await loadAll();
        setCustomerView("orders");
        setCheckoutBanner({
          type: "success",
          text: `Commande ${data.order.orderNumber} confirmée (${data.order.totalMad} MAD Cash à la livraison) !`,
        });
      }
    } catch {
      setCheckoutBanner({
        type: "error",
        text: "Erreur réseau lors de l'envoi de la commande.",
      });
    } finally {
      setSubmittingOrder(false);
    }
  }

  async function handleCancelCustomerOrder(orderId: number) {
    const res = await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    });
    if (res.ok) {
      await loadAll();
    }
  }

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      className="min-h-screen bg-[#F8F7F4] text-[#111111] flex flex-col pb-24 sm:pb-12"
    >
      {/* Top Role & Demo Quick-Switcher Ribbon */}
      <div className="bg-[#111111] text-white border-b border-zinc-800 px-3 py-2 text-xs">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          {demoAccounts.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-zinc-400 mr-1">
              {t.switchRoleDemo} :
            </span>
            {/* 1. Customer Button */}
            {demoAccounts
              .filter((a) => a.role === "customer")
              .slice(0, 1)
              .map((acc) => (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => handleSwitchAccount(acc.id)}
                  className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition ${
                    user?.id === acc.id
                      ? "bg-[#FF5A00] text-white"
                      : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                  }`}
                >
                  <User className="w-3 h-3" />
                  1. {t.roleCustomer} ({acc.fullName.split(" ")[0]})
                </button>
              ))}

            {/* 2. Fleet of 4 Motorcycle Drivers Dropdown/Buttons */}
            <div className="inline-flex items-center bg-zinc-800 rounded-lg p-0.5 border border-zinc-700">
              <Bike className="w-3.5 h-3.5 text-[#FF5A00] mx-1.5" />
              <select
                aria-label="Choisir l'un des 4 livreurs moto"
                value={
                  user?.role === "driver"
                    ? user.id
                    : ""
                }
                onChange={(e) => {
                  if (e.target.value) {
                    handleSwitchAccount(Number(e.target.value));
                  }
                }}
                className={`bg-transparent text-xs font-bold pr-2 py-0.5 focus:outline-none cursor-pointer ${
                  user?.role === "driver" ? "text-[#FF5A00]" : "text-zinc-200"
                }`}
              >
                <option value="" className="bg-zinc-900 text-zinc-300">
                  2. {t.roleDriver} (4 Motos Agadir)...
                </option>
                {demoAccounts
                  .filter((a) => a.role === "driver")
                  .map((drv) => (
                    <option
                      key={drv.id}
                      value={drv.id}
                      className="bg-zinc-900 text-white"
                    >
                      {drv.driverCode} • {drv.fullName}
                    </option>
                  ))}
              </select>
            </div>

            {/* 3. Partner Shop Selector */}
            <div className="inline-flex items-center bg-zinc-800 rounded-lg p-0.5 border border-zinc-700">
              <Store className="w-3.5 h-3.5 text-emerald-400 mx-1.5" />
              <select
                aria-label="Choisir un commerçant partenaire"
                value={user?.role === "partner" ? user.id : ""}
                onChange={(e) => {
                  if (e.target.value) {
                    handleSwitchAccount(Number(e.target.value));
                  }
                }}
                className={`bg-transparent text-xs font-bold pr-2 py-0.5 focus:outline-none cursor-pointer ${
                  user?.role === "partner"
                    ? "text-emerald-400"
                    : "text-zinc-200"
                }`}
              >
                <option value="" className="bg-zinc-900 text-zinc-300">
                  3. {t.rolePartner} (Resto / Souk)...
                </option>
                {demoAccounts
                  .filter((a) => a.role === "partner")
                  .map((part) => (
                    <option
                      key={part.id}
                      value={part.id}
                      className="bg-zinc-900 text-white"
                    >
                      {part.fullName}
                    </option>
                  ))}
              </select>
            </div>

            {/* 4. Administrator Button */}
            {demoAccounts
              .filter((a) => a.role === "admin")
              .map((adm) => (
                <button
                  key={adm.id}
                  type="button"
                  onClick={() => handleSwitchAccount(adm.id)}
                  className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition ${
                    user?.id === adm.id
                      ? "bg-[#FF5A00] text-white"
                      : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                  }`}
                >
                  <ShieldCheck className="w-3 h-3" />
                  4. {t.roleAdmin}
                </button>
              ))}
          </div>
          )}

          <div className="flex items-center gap-2">
            {/* Language FR / AR (RTL) Toggle */}
            <button
              type="button"
              onClick={() => setLang(lang === "fr" ? "ar" : "fr")}
              className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-bold flex items-center gap-1"
            >
              <Globe className="w-3.5 h-3.5 text-[#FF5A00]" />
              {lang === "fr" ? "العربية (RTL)" : "Français (LTR)"}
            </button>

            {/* Android PWA Install Guide */}
            <button
              type="button"
              onClick={() => setInstallModalOpen(true)}
              className="px-2.5 py-1 rounded-lg bg-[#FF5A00]/20 border border-[#FF5A00]/50 text-[#FF5A00] hover:bg-[#FF5A00] hover:text-white font-bold flex items-center gap-1 transition"
            >
              <Smartphone className="w-3.5 h-3.5" />
              {t.installPwa}
            </button>
          </div>
        </div>
      </div>

      {/* Main Sticky Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-zinc-200 px-4 py-3 shadow-2xs">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Brand Logo */}
          <div
            onClick={() => {
              if (user?.role === "customer") {
                setCustomerView("home");
                setSelectedShopId(null);
              }
            }}
            className="flex items-center gap-3 cursor-pointer"
          >
            <div className="w-11 h-11 rounded-2xl bg-[#FF5A00] text-white flex items-center justify-center font-black text-lg shadow-md border-2 border-[#111111]">
              SE
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-lg tracking-tight text-[#111111]">
                  {t.brand}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-[#111111] text-[#FF5A00] text-[10px] font-black uppercase">
                  AGADIR
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 font-medium">
                {t.cityTag}
              </p>
            </div>
          </div>

          {/* Center Zone Selector (when Customer) */}
          {(!user || user.role === "customer") && (
            <div className="flex items-center gap-2 bg-[#F8F7F4] border border-zinc-300 rounded-xl px-3 py-1.5">
              <MapPin className="w-4 h-4 text-[#FF5A00] shrink-0" />
              <div>
                <span className="block text-[10px] text-zinc-500 font-bold">
                  {t.selectZone}
                </span>
                <select
                  aria-label={t.selectZone}
                  value={selectedZoneId}
                  onChange={(e) => setSelectedZoneId(Number(e.target.value))}
                  className="bg-transparent text-xs font-extrabold text-[#111111] focus:outline-none cursor-pointer"
                >
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {lang === "ar" ? z.nameAr : z.nameFr} — {z.deliveryFeeMad}{" "}
                      MAD ({z.estimatedMins})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Right User & Cart Actions */}
          <div className="flex items-center gap-2">
            {(!user || user.role === "customer") && (
              <>
                <button
                  type="button"
                  onClick={() => setCustomerView("home")}
                  className={`px-3 py-2 rounded-xl text-xs font-extrabold transition ${
                    customerView === "home"
                      ? "bg-[#111111] text-white"
                      : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                  }`}
                >
                  Catalogue
                </button>
                <button
                  type="button"
                  onClick={() => setCustomerView("orders")}
                  className={`px-3 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition ${
                    customerView === "orders"
                      ? "bg-[#111111] text-white"
                      : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                  }`}
                >
                  <Clock className="w-3.5 h-3.5 text-[#FF5A00]" />
                  <span className="hidden sm:inline">{t.myOrders}</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-[#FF5A00] text-white text-[10px] font-mono">
                    {customerOrders.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setCustomerView("cart")}
                  className="px-3.5 py-2 rounded-xl bg-[#FF5A00] hover:bg-[#E04F00] text-white text-xs font-extrabold flex items-center gap-2 shadow-sm transition"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>{cartItemsCount}</span>
                  <span className="hidden sm:inline font-mono">
                    • {cartSubtotalMad} MAD
                  </span>
                </button>
              </>
            )}

            {/* Auth Account Pill */}
            {user ? (
              <div className="flex items-center gap-1.5 pl-2 border-l border-zinc-200">
                <button
                  type="button"
                  onClick={() => setAuthModalOpen(true)}
                  className="px-2.5 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-xs font-bold text-zinc-800 flex items-center gap-1.5"
                >
                  <User className="w-3.5 h-3.5 text-[#FF5A00]" />
                  <span className="max-w-[110px] truncate">
                    {user.fullName}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="p-2 rounded-xl bg-zinc-100 hover:bg-red-50 hover:text-red-600 text-zinc-500"
                  title={t.logout}
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-[#111111] text-white text-xs font-bold"
              >
                {t.loginTitle}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ROLE-BASED VIEW ROUTER */}
      {user?.role === "driver" ? (
        <DriverPortal lang={lang} user={user} onUserUpdated={loadAll} />
      ) : user?.role === "partner" ? (
        <PartnerPortal lang={lang} user={user} />
      ) : user?.role === "admin" ? (
        <AdminPortal lang={lang} />
      ) : (
        /* CUSTOMER MARKETPLACE, CART/CHECKOUT & ORDER TRACKING */
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 space-y-6">
          {checkoutBanner && (
            <div
              className={`p-4 rounded-2xl font-bold text-sm flex items-center justify-between shadow-md ${
                checkoutBanner.type === "success"
                  ? "bg-emerald-600 text-white"
                  : "bg-red-600 text-white"
              }`}
            >
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                {checkoutBanner.text}
              </span>
              <button
                type="button"
                onClick={() => setCheckoutBanner(null)}
                className="text-xs underline ml-4"
              >
                Fermer
              </button>
            </div>
          )}

          {customerView === "home" && (
            <>
              {/* Hero Banner + 10-Stamp Loyalty Card */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 rounded-3xl bg-gradient-to-br from-[#111111] via-[#1C1917] to-[#292524] text-white p-6 sm:p-8 shadow-xl relative overflow-hidden flex flex-col justify-between">
                  <div className="space-y-3 max-w-xl">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FF5A00] text-white text-xs font-black uppercase tracking-wider">
                      <Bike className="w-3.5 h-3.5" />
                      Flotte 4 Livreurs Moto • Agadir
                    </span>
                    <h1 className="text-2xl sm:text-3xl font-black leading-tight">
                      {t.heroTitle}
                    </h1>
                    <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                      {t.heroSubtitle}
                    </p>
                  </div>

                  {/* Active Promo Pills */}
                  <div className="mt-5 pt-4 border-t border-zinc-800 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-zinc-400 flex items-center gap-1">
                      <Tag className="w-3.5 h-3.5 text-[#FF5A00]" />
                      Codes Promos Actifs :
                    </span>
                    {promotions.map((promo) => (
                      <button
                        key={promo.id}
                        type="button"
                        onClick={() => {
                          setPromoCodeInput(promo.code);
                          setCustomerView("cart");
                        }}
                        className="px-3 py-1 rounded-full bg-zinc-800 hover:bg-[#FF5A00] text-white text-xs font-mono font-bold transition"
                      >
                        {promo.code} (-{promo.discountMad} MAD)
                      </button>
                    ))}
                  </div>
                </div>

                {/* 10-Stamp Loyalty Card Widget */}
                <div className="rounded-3xl bg-white border-2 border-[#FF5A00] p-5 shadow-md flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="px-2.5 py-1 rounded-lg bg-orange-50 text-[#FF5A00] font-black text-xs flex items-center gap-1">
                        <Award className="w-4 h-4" />
                        {t.loyaltyCardTitle}
                      </span>
                      <span className="font-mono font-black text-sm text-[#111111]">
                        {loyalty?.stampsCount ?? 0} / 10
                      </span>
                    </div>
                    <p className="text-xs text-zinc-600 mb-3">
                      {t.loyaltyStampsDesc}
                    </p>

                    <div className="grid grid-cols-5 gap-2 my-2">
                      {Array.from({ length: 10 }).map((_, idx) => {
                        const stamped = idx < (loyalty?.stampsCount ?? 0);
                        return (
                          <div
                            key={idx}
                            className={`h-9 rounded-xl flex items-center justify-center font-black text-xs border transition ${
                              stamped
                                ? "bg-[#FF5A00] text-white border-[#FF5A00] shadow-xs"
                                : "bg-zinc-50 text-zinc-400 border-zinc-200"
                            }`}
                          >
                            {stamped ? "★" : idx + 1}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-zinc-100 flex items-center justify-between text-xs">
                    <span className="font-bold text-zinc-600">
                      Points cumulés :{" "}
                      <strong className="text-[#111111]">
                        {loyalty?.pointsBalance ?? 0} pts
                      </strong>
                    </span>
                    {(loyalty?.stampsCount ?? 0) >= 10 ? (
                      <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-extrabold">
                        -25 MAD Prêt !
                      </span>
                    ) : (
                      <span className="text-zinc-500">
                        Plus que {Math.max(0, 10 - (loyalty?.stampsCount ?? 0))}{" "}
                        commandes
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Search & Category Pills */}
              <div className="bg-white rounded-2xl p-4 border border-zinc-200 shadow-2xs space-y-3">
                <div className="relative">
                  <Search className="w-5 h-5 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t.searchPlaceholder}
                    className="w-full pl-11 pr-4 py-3 rounded-xl bg-[#F8F7F4] border border-zinc-200 text-sm font-medium focus:outline-none focus:border-[#FF5A00]"
                  />
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {[
                    { id: "all", label: t.allCategories },
                    { id: "restaurants", label: t.catRestaurants },
                    { id: "souk", label: t.catSouk },
                    { id: "patisserie", label: t.catPatisserie },
                    { id: "epicerie", label: t.catEpicerie },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setSelectedCategory(cat.id);
                        setSelectedShopId(null);
                      }}
                      className={`px-4 py-2 rounded-full text-xs font-extrabold whitespace-nowrap transition ${
                        selectedCategory === cat.id && !selectedShopId
                          ? "bg-[#FF5A00] text-white shadow-xs"
                          : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Partner Shops Horizontal Showcase */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-extrabold text-[#111111]">
                    Commerces & Restaurants Partenaires à Agadir (
                    {filteredShops.length})
                  </h2>
                  {selectedShopId && (
                    <button
                      type="button"
                      onClick={() => setSelectedShopId(null)}
                      className="text-xs font-extrabold text-[#FF5A00] hover:underline"
                    >
                      Voir tous les commerces
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {filteredShops.map((shop) => {
                    const isSelected = selectedShopId === shop.id;
                    return (
                      <div
                        key={shop.id}
                        onClick={() =>
                          setSelectedShopId(isSelected ? null : shop.id)
                        }
                        className={`group cursor-pointer rounded-2xl bg-white overflow-hidden border transition shadow-2xs hover:shadow-md ${
                          isSelected
                            ? "border-2 border-[#FF5A00] ring-2 ring-[#FF5A00]/20"
                            : "border-zinc-200"
                        }`}
                      >
                        <div className="relative h-36 bg-zinc-900 overflow-hidden">
                          <img
                            src={shop.imageUrl}
                            alt={lang === "ar" ? shop.nameAr : shop.nameFr}
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                          />
                          <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                shop.isOpen
                                  ? "bg-emerald-500 text-white"
                                  : "bg-zinc-800 text-zinc-300"
                              }`}
                            >
                              {shop.isOpen ? t.openNow : t.closed}
                            </span>
                          </div>
                          <div className="absolute bottom-2.5 right-2.5 px-2.5 py-1 rounded-lg bg-black/80 text-white text-xs font-bold flex items-center gap-1">
                            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                            <span>{shop.rating}</span>
                          </div>
                        </div>

                        <div className="p-4 space-y-1.5">
                          <h3 className="font-extrabold text-sm text-[#111111] line-clamp-1">
                            {lang === "ar" ? shop.nameAr : shop.nameFr}
                          </h3>
                          <p className="text-xs text-zinc-500 line-clamp-2">
                            {lang === "ar"
                              ? shop.descriptionAr
                              : shop.descriptionFr}
                          </p>
                          <div className="pt-2 flex items-center justify-between text-[11px] font-bold text-zinc-600">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-[#FF5A00]" />
                              {shop.prepTimeMins}
                            </span>
                            <span className="text-[#FF5A00]">
                              {t.deliveryFee}: {deliveryFeeMad} MAD
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Products Grid */}
              <section className="space-y-3">
                <h2 className="text-lg font-extrabold text-[#111111]">
                  {selectedShopId
                    ? `Menu — ${
                        shops.find((s) => s.id === selectedShopId)?.nameFr || ""
                      }`
                    : "Plats, Spécialités & Produits du Souk"}{" "}
                  ({filteredProducts.length})
                </h2>

                {loadingCatalog ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <div
                        key={n}
                        className="h-36 rounded-2xl bg-zinc-200 animate-pulse"
                      />
                    ))}
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="bg-white rounded-2xl p-8 text-center border border-zinc-200">
                    <p className="font-bold text-zinc-700">
                      Aucun produit ne correspond à votre recherche.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredProducts.map((prod) => {
                      const parentShop = shops.find(
                        (s) => s.id === prod.shopId
                      );
                      const inCart = cart.find(
                        (c) => c.product.id === prod.id
                      )?.quantity;

                      return (
                        <div
                          key={prod.id}
                          className="bg-white rounded-2xl p-3.5 border border-zinc-200 shadow-2xs hover:shadow-md transition flex gap-3.5"
                        >
                          <div
                            onClick={() => setDetailProduct(prod)}
                            className="w-28 h-28 rounded-xl overflow-hidden bg-zinc-100 shrink-0 cursor-pointer relative"
                          >
                            <img
                              src={prod.imageUrl}
                              alt={lang === "ar" ? prod.nameAr : prod.nameFr}
                              className="w-full h-full object-cover hover:scale-105 transition"
                            />
                            <span className="absolute bottom-1.5 left-1.5 px-2 py-0.5 rounded-md bg-black/75 text-white font-mono font-black text-xs">
                              {prod.priceMad} MAD
                            </span>
                          </div>

                          <div className="flex-1 flex flex-col justify-between">
                            <div>
                              <span className="text-[10px] font-bold text-[#FF5A00] uppercase">
                                {parentShop
                                  ? lang === "ar"
                                    ? parentShop.nameAr
                                    : parentShop.nameFr
                                  : "Souk Express"}
                              </span>
                              <h3
                                onClick={() => setDetailProduct(prod)}
                                className="font-extrabold text-sm text-[#111111] leading-snug cursor-pointer hover:text-[#FF5A00]"
                              >
                                {lang === "ar" ? prod.nameAr : prod.nameFr}
                              </h3>
                              <p className="text-xs text-zinc-500 line-clamp-2 mt-0.5">
                                {lang === "ar"
                                  ? prod.descriptionAr
                                  : prod.descriptionFr}
                              </p>
                            </div>

                            <div className="pt-2 flex items-center justify-between">
                              <span className="font-mono font-black text-sm text-[#111111]">
                                {prod.priceMad} MAD
                              </span>

                              {prod.isAvailable ? (
                                <button
                                  type="button"
                                  onClick={() => handleAddToCart(prod, 1)}
                                  className="px-3.5 py-1.5 rounded-xl bg-[#FF5A00] hover:bg-[#E04F00] text-white font-extrabold text-xs flex items-center gap-1 shadow-xs transition"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  {t.addToCart}
                                  {inCart ? ` (${inCart})` : ""}
                                </button>
                              ) : (
                                <span className="px-2.5 py-1 rounded-lg bg-zinc-100 text-zinc-400 font-bold text-xs">
                                  {t.outOfStock}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          )}

          {/* VIEW 2: SHOPPING CART & CASH ON DELIVERY CHECKOUT */}
          {customerView === "cart" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Cart Items Column */}
              <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-zinc-200 space-y-4 h-fit">
                <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                  <h2 className="text-xl font-extrabold flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5 text-[#FF5A00]" />
                    {t.cartTitle} ({cartItemsCount})
                  </h2>
                  {cart.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setCart([])}
                      className="text-xs font-bold text-red-600 hover:underline flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Vider
                    </button>
                  )}
                </div>

                {cart.length === 0 ? (
                  <div className="py-10 text-center space-y-3">
                    <ShoppingBag className="w-12 h-12 text-zinc-300 mx-auto" />
                    <p className="font-bold text-zinc-700">{t.emptyCart}</p>
                    <button
                      type="button"
                      onClick={() => setCustomerView("home")}
                      className="px-5 py-2.5 rounded-xl bg-[#FF5A00] text-white font-bold text-xs"
                    >
                      Découvrir les commerces d&apos;Agadir
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {cart.map((item) => (
                      <div
                        key={item.product.id}
                        className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#F8F7F4] border border-zinc-200"
                      >
                        <div className="flex items-center gap-3">
                          <img
                            src={item.product.imageUrl}
                            alt={item.product.nameFr}
                            className="w-14 h-14 rounded-xl object-cover"
                          />
                          <div>
                            <h4 className="font-extrabold text-sm text-[#111111]">
                              {lang === "ar"
                                ? item.product.nameAr
                                : item.product.nameFr}
                            </h4>
                            <p className="text-xs font-mono text-zinc-500">
                              {item.product.priceMad} MAD / unité
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="flex items-center bg-white border border-zinc-300 rounded-xl">
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateCartQty(item.product.id, -1)
                              }
                              className="p-2 text-zinc-700 hover:bg-zinc-100"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="px-3 font-mono font-bold text-xs">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateCartQty(item.product.id, 1)
                              }
                              className="p-2 text-zinc-700 hover:bg-zinc-100"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <span className="font-mono font-black text-sm w-20 text-right">
                            {item.product.priceMad * item.quantity} MAD
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Delivery Details & Server-Verified Checkout Summary */}
              <form
                onSubmit={handleCheckoutSubmit}
                className="bg-white rounded-2xl p-6 border-2 border-[#111111] shadow-lg space-y-4 h-fit"
              >
                <h3 className="font-extrabold text-lg text-[#111111]">
                  Livraison & Paiement Cash (Agadir)
                </h3>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">
                    {t.selectZone}
                  </label>
                  <select
                    value={selectedZoneId}
                    onChange={(e) => setSelectedZoneId(Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-xl border border-zinc-300 bg-[#F8F7F4] text-xs font-bold"
                  >
                    {zones.map((z) => (
                      <option key={z.id} value={z.id}>
                        {lang === "ar" ? z.nameAr : z.nameFr} (+
                        {z.deliveryFeeMad} MAD)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">
                    {t.addressLabel} *
                  </label>
                  <input
                    type="text"
                    required
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="Rue, Immeuble, Numéro d'appartement..."
                    className="w-full px-3 py-2.5 rounded-xl border border-zinc-300 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">
                    {t.landmarkLabel}
                  </label>
                  <input
                    type="text"
                    value={deliveryLandmark}
                    onChange={(e) => setDeliveryLandmark(e.target.value)}
                    placeholder="ex: En face du Jardin Olhão / Près Mosquée..."
                    className="w-full px-3 py-2.5 rounded-xl border border-zinc-300 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">
                    {t.phoneLabel} *
                  </label>
                  <input
                    type="tel"
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-zinc-300 text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">
                    {t.notesLabel}
                  </label>
                  <textarea
                    rows={2}
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    placeholder="Code interphone, étage, préférence cuisson..."
                    className="w-full px-3 py-2 rounded-xl border border-zinc-300 text-xs"
                  />
                </div>

                {/* Promo Code Input */}
                <div className="pt-2 border-t border-zinc-100">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={promoCodeInput}
                      onChange={(e) =>
                        setPromoCodeInput(e.target.value.toUpperCase())
                      }
                      placeholder={t.promoPlaceholder}
                      className="flex-1 px-3 py-2 rounded-xl border border-zinc-300 text-xs font-mono uppercase"
                    />
                    <button
                      type="button"
                      onClick={handleApplyPromoCode}
                      className="px-3.5 py-2 rounded-xl bg-[#111111] text-white font-bold text-xs"
                    >
                      {t.applyPromo}
                    </button>
                  </div>
                </div>

                {/* 10-Stamp Loyalty Redemption Toggle */}
                {(loyalty?.stampsCount ?? 0) >= 10 && (
                  <label className="flex items-center justify-between p-3 rounded-xl bg-orange-50 border border-[#FF5A00] cursor-pointer">
                    <span className="text-xs font-extrabold text-[#111111] flex items-center gap-1.5">
                      <Award className="w-4 h-4 text-[#FF5A00]" />
                      {t.redeemLoyalty}
                    </span>
                    <input
                      type="checkbox"
                      checked={redeemTenStamps}
                      onChange={(e) => setRedeemTenStamps(e.target.checked)}
                      className="w-4 h-4 accent-[#FF5A00]"
                    />
                  </label>
                )}

                {/* Transparent Breakdown before confirmation */}
                <div className="p-4 rounded-xl bg-[#F8F7F4] border border-zinc-200 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-zinc-600">{t.subtotal}</span>
                    <span className="font-mono font-bold">
                      {cartSubtotalMad} MAD
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-600">
                      {t.deliveryFee} ({activeZone?.nameFr})
                    </span>
                    <span className="font-mono font-bold">
                      +{deliveryFeeMad} MAD
                    </span>
                  </div>
                  {discountMad > 0 && (
                    <div className="flex justify-between text-emerald-600 font-bold">
                      <span>{t.discount}</span>
                      <span className="font-mono">-{discountMad} MAD</span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-zinc-300 flex justify-between items-center text-sm font-black text-[#111111]">
                    <span>{t.totalToPay}</span>
                    <span className="text-lg text-[#FF5A00] font-mono">
                      {cartTotalMad} MAD
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={cart.length === 0 || submittingOrder}
                  className="w-full py-4 rounded-xl bg-[#FF5A00] hover:bg-[#E04F00] text-white font-extrabold text-sm shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <span>
                    {submittingOrder
                      ? "Validation sécurisée..."
                      : `${t.checkoutBtn} • ${cartTotalMad} MAD`}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>
          )}

          {/* VIEW 3: LIVE ORDER TRACKING & HISTORY */}
          {customerView === "orders" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-extrabold text-[#111111] flex items-center gap-2">
                  <Package className="w-5 h-5 text-[#FF5A00]" />
                  {t.myOrders} ({customerOrders.length})
                </h2>
                <button
                  type="button"
                  onClick={loadAll}
                  className="px-3.5 py-2 rounded-xl bg-white border border-zinc-300 text-xs font-bold"
                >
                  Actualiser le suivi
                </button>
              </div>

              {customerOrders.length === 0 ? (
                <div className="bg-white rounded-2xl p-8 text-center border border-zinc-200">
                  <p className="font-bold text-zinc-700">
                    Vous n&apos;avez pas encore de commande.
                  </p>
                </div>
              ) : (
                customerOrders.map((ord) => {
                  const steps = [
                    { key: "pending", label: t.status_pending },
                    { key: "accepted", label: t.status_accepted },
                    { key: "preparing", label: t.status_preparing },
                    { key: "assigned", label: t.status_assigned },
                    { key: "picked_up", label: t.status_picked_up },
                    { key: "on_the_way", label: t.status_on_the_way },
                    { key: "delivered", label: t.status_delivered },
                  ];
                  const currentStepIdx = steps.findIndex(
                    (s) => s.key === ord.status
                  );

                  return (
                    <div
                      key={ord.id}
                      className="bg-white rounded-2xl p-5 border border-zinc-200 shadow-xs space-y-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-zinc-100">
                        <div className="flex items-center gap-2.5">
                          <span className="px-3 py-1 rounded-lg bg-[#111111] text-white font-mono font-black text-xs">
                            {ord.orderNumber}
                          </span>
                          <span className="font-extrabold text-sm text-[#111111]">
                            {ord.shopNameSnapshot}
                          </span>
                          <span className="text-xs text-zinc-500">
                            • {ord.deliveryZoneSnapshot}
                          </span>
                        </div>
                        <div className="text-right font-mono">
                          <span className="text-base font-black text-[#FF5A00]">
                            {ord.totalMad} MAD (Cash COD)
                          </span>
                        </div>
                      </div>

                      {/* Visual Status Stepper */}
                      {ord.status === "rejected" ||
                      ord.status === "cancelled" ? (
                        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold flex items-center gap-2">
                          <XCircle className="w-4 h-4" />
                          <span>
                            {ord.status === "rejected"
                              ? `${t.status_rejected} ${
                                  ord.rejectionReason
                                    ? `: ${ord.rejectionReason}`
                                    : ""
                                }`
                              : t.status_cancelled}
                          </span>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-7 gap-2">
                          {steps.map((st, idx) => {
                            const done = idx <= currentStepIdx;
                            const current = idx === currentStepIdx;
                            return (
                              <div
                                key={st.key}
                                className={`p-2.5 rounded-xl border text-[11px] font-bold transition ${
                                  current
                                    ? "bg-[#FF5A00] text-white border-[#FF5A00] shadow-xs"
                                    : done
                                      ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                                      : "bg-zinc-50 text-zinc-400 border-zinc-200"
                                }`}
                              >
                                <span className="block font-mono text-[10px] opacity-75">
                                  Étape {idx + 1}
                                </span>
                                {st.label}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Assigned Motorcycle Driver Box */}
                      {ord.driverInfo && (
                        <div className="p-3.5 rounded-xl bg-zinc-900 text-white flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-[#FF5A00] flex items-center justify-center font-black text-xs font-mono">
                              {ord.driverInfo.driverCode || "MOTO"}
                            </div>
                            <div>
                              <p className="text-xs font-extrabold">
                                Livreur Moto : {ord.driverInfo.fullName}
                              </p>
                              <p className="text-[11px] text-zinc-400 font-mono">
                                Matricule : {ord.driverInfo.vehiclePlate} •{" "}
                                {ord.driverInfo.phone}
                              </p>
                            </div>
                          </div>
                          <a
                            href={`tel:${ord.driverInfo.phone}`}
                            className="px-3.5 py-2 rounded-xl bg-[#FF5A00] text-white font-bold text-xs"
                          >
                            Appeler le livreur
                          </a>
                        </div>
                      )}

                      {/* Order Items & Actions */}
                      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-600 pt-1">
                        <div>
                          <strong>Articles :</strong>{" "}
                          {ord.items
                            .map(
                              (i) =>
                                `${i.quantity}x ${
                                  lang === "ar"
                                    ? i.productNameArSnapshot
                                    : i.productNameFrSnapshot
                                } (${i.unitPriceMadSnapshot} MAD)`
                            )
                            .join(" • ")}
                        </div>

                        <div className="flex items-center gap-2">
                          {ord.status === "pending" && (
                            <button
                              type="button"
                              onClick={() => handleCancelCustomerOrder(ord.id)}
                              className="px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs"
                            >
                              Annuler la commande
                            </button>
                          )}
                          <a
                            href={`https://wa.me/212661102030?text=${encodeURIComponent(
                              `Salam Support Souk Express Agadir, question concernant ma commande ${ord.orderNumber}`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-bold text-xs flex items-center gap-1"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            Aide WhatsApp
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </main>
      )}

      {/* Floating WhatsApp Support Button & Sticky Mobile Cart Bar */}
      <a
        href="https://wa.me/212661102030?text=Salam%20Souk%20Express%20Agadir%2C%20j%27ai%20besoin%20d%27aide"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-20 sm:bottom-6 right-4 z-40 px-4 py-3 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-xl flex items-center gap-2 transition"
      >
        <MessageCircle className="w-4 h-4" />
        <span>{t.whatsappSupport}</span>
      </a>

      {/* Mobile Bottom Navigation Bar for Customer */}
      {(!user || user.role === "customer") && (
        <nav className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-zinc-200 px-4 py-2 flex items-center justify-around">
          <button
            type="button"
            onClick={() => setCustomerView("home")}
            className={`flex flex-col items-center gap-0.5 text-[11px] font-bold ${
              customerView === "home" ? "text-[#FF5A00]" : "text-zinc-500"
            }`}
          >
            <Store className="w-5 h-5" />
            <span>Agadir</span>
          </button>
          <button
            type="button"
            onClick={() => setCustomerView("cart")}
            className={`flex flex-col items-center gap-0.5 text-[11px] font-bold ${
              customerView === "cart" ? "text-[#FF5A00]" : "text-zinc-500"
            }`}
          >
            <ShoppingBag className="w-5 h-5" />
            <span>Panier ({cartItemsCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setCustomerView("orders")}
            className={`flex flex-col items-center gap-0.5 text-[11px] font-bold ${
              customerView === "orders" ? "text-[#FF5A00]" : "text-zinc-500"
            }`}
          >
            <Clock className="w-5 h-5" />
            <span>Suivi ({customerOrders.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setInstallModalOpen(true)}
            className="flex flex-col items-center gap-0.5 text-[11px] font-bold text-zinc-500"
          >
            <Smartphone className="w-5 h-5" />
            <span>App Android</span>
          </button>
        </nav>
      )}

      {/* Modals */}
      <AndroidInstallModal
        isOpen={installModalOpen}
        onClose={() => setInstallModalOpen(false)}
        deferredPrompt={deferredPrompt}
        onTriggerNativeInstall={async () => {
          const promptObj = deferredPrompt as {
            prompt?: () => Promise<void>;
          } | null;
          if (promptObj && typeof promptObj.prompt === "function") {
            await promptObj.prompt();
            setDeferredPrompt(null);
          }
          setInstallModalOpen(false);
        }}
      />

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={loadAll}
      />

      <ProductDetailModal
        product={detailProduct}
        shopName={
          detailProduct
            ? shops.find((s) => s.id === detailProduct.shopId)?.nameFr ||
              "Souk Express Agadir"
            : ""
        }
        lang={lang}
        onClose={() => setDetailProduct(null)}
        onAddToCart={handleAddToCart}
      />
    </div>
  );
}
