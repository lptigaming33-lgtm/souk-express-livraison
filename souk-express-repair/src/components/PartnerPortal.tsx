"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Store,
  Plus,
  CheckCircle2,
  XCircle,
  ChefHat,
  Package,
  RefreshCw,
  AlertTriangle,
  Power,
  DollarSign,
} from "lucide-react";
import { translations, type Lang } from "@/lib/i18n";

interface PartnerShop {
  id: number;
  ownerId: number;
  nameFr: string;
  nameAr: string;
  category: string;
  address: string;
  phone: string;
  commissionRate: number;
  isApproved: boolean;
  isOpen: boolean;
}

interface PartnerProduct {
  id: number;
  shopId: number;
  nameFr: string;
  nameAr: string;
  descriptionFr: string;
  descriptionAr: string;
  priceMad: number;
  categoryFr: string;
  categoryAr: string;
  imageUrl: string;
  isAvailable: boolean;
}

interface PartnerOrder {
  id: number;
  orderNumber: string;
  shopId: number;
  status: string;
  subtotalMad: number;
  commissionMad: number;
  partnerPayoutMad: number;
  totalMad: number;
  customerNameSnapshot: string;
  customerPhoneSnapshot: string;
  deliveryZoneSnapshot: string;
  orderNotes: string;
  rejectionReason: string | null;
  createdAt: string;
  items: Array<{
    id: number;
    productNameFrSnapshot: string;
    productNameArSnapshot: string;
    unitPriceMadSnapshot: number;
    quantity: number;
    lineTotalMad: number;
  }>;
}

interface PartnerPortalProps {
  lang: Lang;
  user: {
    id: number;
    fullName: string;
    role: string;
  };
}

export function PartnerPortal({ lang, user }: PartnerPortalProps) {
  const t = translations[lang];
  const [shops, setShops] = useState<PartnerShop[]>([]);
  const [selectedShopId, setSelectedShopId] = useState<number | null>(null);
  const [products, setProducts] = useState<PartnerProduct[]>([]);
  const [orders, setOrders] = useState<PartnerOrder[]>([]);
  const [stats, setStats] = useState({
    totalOrders: 0,
    deliveredOrders: 0,
    grossSalesMad: 0,
    totalCommissionMad: 0,
    netPayoutMad: 0,
  });
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState("");
  const [activeSubTab, setActiveSubTab] = useState<"orders" | "products">(
    "orders"
  );

  // New Product form
  const [newProdNameFr, setNewProdNameFr] = useState("");
  const [newProdNameAr, setNewProdNameAr] = useState("");
  const [newProdDescFr, setNewProdDescFr] = useState("");
  const [newProdPriceMad, setNewProdPriceMad] = useState("45");
  const [newProdCatFr, setNewProdCatFr] = useState("Spécialités");
  const [newProdImage, setNewProdImage] = useState(
    "https://images.unsplash.com/photo-1541518763669-27fef04b14ea?auto=format&fit=crop&w=700&q=80"
  );
  const [priceEdits, setPriceEdits] = useState<Record<number, number>>({});
  const [rejectReasons, setRejectReasons] = useState<Record<number, string>>(
    {}
  );

  const loadPartnerData = useCallback(async () => {
    setLoading(true);
    try {
      const [partRes, ordRes] = await Promise.all([
        fetch("/api/partner"),
        fetch("/api/orders"),
      ]);
      if (partRes.ok) {
        const partData = await partRes.json();
        const shopList: PartnerShop[] = partData.shops || [];
        setShops(shopList);
        if (shopList.length > 0 && !selectedShopId) {
          setSelectedShopId(shopList[0]!.id);
        }
        const prodList: PartnerProduct[] = partData.products || [];
        setProducts(prodList);
        const edits: Record<number, number> = {};
        prodList.forEach((p) => {
          edits[p.id] = p.priceMad;
        });
        setPriceEdits((prev) => ({ ...edits, ...prev }));
        if (partData.stats) setStats(partData.stats);
      }
      if (ordRes.ok) {
        const ordData = await ordRes.json();
        setOrders(ordData.orders || []);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedShopId]);

  useEffect(() => {
    loadPartnerData();
  }, [loadPartnerData, user.id]);

  const activeShop =
    shops.find((s) => s.id === selectedShopId) ?? shops[0] ?? null;

  async function handleToggleShopOpen() {
    if (!activeShop) return;
    await fetch("/api/partner", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "toggle_shop_open",
        shopId: activeShop.id,
        isOpen: !activeShop.isOpen,
      }),
    });
    setFeedback(
      !activeShop.isOpen
        ? "Commerce ouvert aux commandes !"
        : "Commerce mis en pause."
    );
    await loadPartnerData();
    setTimeout(() => setFeedback(""), 3000);
  }

  async function handleOrderStatus(
    orderId: number,
    nextStatus: "accepted" | "preparing" | "rejected"
  ) {
    const rejectionReason =
      nextStatus === "rejected"
        ? rejectReasons[orderId] || "Rupture de stock momentanée"
        : undefined;

    const res = await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus, rejectionReason }),
    });
    if (res.ok) {
      setFeedback(`Commande mise à jour (${nextStatus}) !`);
      await loadPartnerData();
    }
    setTimeout(() => setFeedback(""), 3000);
  }

  async function handleAddProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!activeShop) return;
    const res = await fetch("/api/partner", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shopId: activeShop.id,
        nameFr: newProdNameFr,
        nameAr: newProdNameAr || newProdNameFr,
        descriptionFr: newProdDescFr || "Spécialité préparée à Agadir.",
        priceMad: Number(newProdPriceMad),
        categoryFr: newProdCatFr,
        imageUrl: newProdImage,
      }),
    });
    if (res.ok) {
      setNewProdNameFr("");
      setNewProdNameAr("");
      setNewProdDescFr("");
      setFeedback("Nouveau produit ajouté au catalogue !");
      await loadPartnerData();
      setTimeout(() => setFeedback(""), 3000);
    }
  }

  async function handleUpdateProduct(
    productId: number,
    isAvailable: boolean,
    priceMad: number
  ) {
    const res = await fetch("/api/partner", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId,
        isAvailable,
        priceMad,
      }),
    });
    if (res.ok) {
      setFeedback("Produit mis à jour ! (Les anciennes commandes gardent leur prix initial)");
      await loadPartnerData();
      setTimeout(() => setFeedback(""), 3500);
    }
  }

  const filteredProducts = activeShop
    ? products.filter((p) => p.shopId === activeShop.id)
    : products;
  const filteredOrders = activeShop
    ? orders.filter((o) => o.shopId === activeShop.id)
    : orders;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Partner Header */}
      <div className="bg-[#111111] text-white rounded-2xl p-5 shadow-xl border border-zinc-800">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#FF5A00] flex items-center justify-center text-white">
              <Store className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold">{t.partnerPortalTitle}</h1>
              <p className="text-xs text-zinc-400">
                {activeShop
                  ? `${activeShop.nameFr} • ${activeShop.address}`
                  : user.fullName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {shops.length > 1 && (
              <select
                value={activeShop?.id ?? ""}
                onChange={(e) => setSelectedShopId(Number(e.target.value))}
                className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs font-bold text-white"
              >
                {shops.map((sh) => (
                  <option key={sh.id} value={sh.id}>
                    {sh.nameFr} {sh.isApproved ? "✓" : "(En attente)"}
                  </option>
                ))}
              </select>
            )}

            {activeShop && (
              <button
                type="button"
                onClick={handleToggleShopOpen}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition ${
                  activeShop.isOpen
                    ? "bg-emerald-500 text-white"
                    : "bg-zinc-800 text-zinc-300"
                }`}
              >
                <Power className="w-4 h-4" />
                {activeShop.isOpen ? t.openNow : t.closed}
              </button>
            )}

            <button
              type="button"
              onClick={loadPartnerData}
              className="p-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        </div>

        {/* Approval Banner */}
        {activeShop && !activeShop.isApproved ? (
          <div className="mt-4 p-3.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-200 flex items-center gap-3 text-xs font-semibold">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <span>
              <strong>Compte en attente d&apos;approbation Admin :</strong> Votre
              boutique « {activeShop.nameFr} » doit être validée par
              l&apos;administrateur Souk Express avant d&apos;être visible par
              les clients d&apos;Agadir.
            </span>
          </div>
        ) : activeShop ? (
          <div className="mt-4 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 flex items-center justify-between text-xs font-semibold">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Commerce Approuvé par l&apos;Administrateur • Visible dans le
              catalogue Agadir
            </span>
            <span className="font-mono">
              Commission Souk Express : {activeShop.commissionRate}%
            </span>
          </div>
        ) : null}

        {/* Financial KPIs */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="bg-zinc-900 rounded-xl p-3 border border-zinc-800">
            <p className="text-[11px] text-zinc-400">Ventes Livrées (Brut)</p>
            <p className="text-lg font-black text-white font-mono">
              {stats.grossSalesMad} MAD
            </p>
          </div>
          <div className="bg-zinc-900 rounded-xl p-3 border border-zinc-800">
            <p className="text-[11px] text-zinc-400">Commission Souk Express</p>
            <p className="text-lg font-black text-[#FF5A00] font-mono">
              -{stats.totalCommissionMad} MAD
            </p>
          </div>
          <div className="bg-zinc-900 rounded-xl p-3 border border-zinc-800">
            <p className="text-[11px] text-zinc-400">Reversement Net Commerce</p>
            <p className="text-lg font-black text-emerald-400 font-mono">
              {stats.netPayoutMad} MAD
            </p>
          </div>
        </div>
      </div>

      {feedback && (
        <div className="p-3.5 rounded-xl bg-emerald-600 text-white font-bold text-sm flex items-center gap-2 shadow-md">
          <CheckCircle2 className="w-5 h-5" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Sub-navigation */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setActiveSubTab("orders")}
          className={`px-4 py-2.5 rounded-xl font-extrabold text-xs flex items-center gap-2 transition ${
            activeSubTab === "orders"
              ? "bg-[#FF5A00] text-white shadow-sm"
              : "bg-white text-zinc-700 border border-zinc-200"
          }`}
        >
          <ChefHat className="w-4 h-4" />
          Commandes Reçues & Historique ({filteredOrders.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab("products")}
          className={`px-4 py-2.5 rounded-xl font-extrabold text-xs flex items-center gap-2 transition ${
            activeSubTab === "products"
              ? "bg-[#FF5A00] text-white shadow-sm"
              : "bg-white text-zinc-700 border border-zinc-200"
          }`}
        >
          <Package className="w-4 h-4" />
          Catalogue Produits & Stock ({filteredProducts.length})
        </button>
      </div>

      {activeSubTab === "orders" ? (
        <div className="space-y-4">
          {filteredOrders.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center border border-zinc-200">
              <ChefHat className="w-10 h-10 text-zinc-400 mx-auto mb-2" />
              <p className="font-bold text-zinc-700">
                Aucune commande pour ce commerce
              </p>
            </div>
          ) : (
            filteredOrders.map((ord) => (
              <div
                key={ord.id}
                className="bg-white rounded-2xl p-5 border border-zinc-200 shadow-xs space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-zinc-100">
                  <div className="flex items-center gap-2.5">
                    <span className="px-3 py-1 rounded-lg bg-[#111111] text-white font-mono font-black text-xs">
                      {ord.orderNumber}
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-orange-50 text-[#FF5A00] font-extrabold text-xs uppercase">
                      {ord.status}
                    </span>
                    <span className="text-xs text-zinc-500">
                      Client : <strong>{ord.customerNameSnapshot}</strong> (
                      {ord.deliveryZoneSnapshot})
                    </span>
                  </div>
                  <div className="text-right font-mono">
                    <span className="text-xs text-zinc-500 block">
                      Sous-total produits : {ord.subtotalMad} MAD
                    </span>
                    <span className="text-sm font-black text-emerald-600">
                      Net Partenaire : {ord.partnerPayoutMad} MAD
                    </span>
                  </div>
                </div>

                <ul className="space-y-1 text-xs text-zinc-700">
                  {ord.items.map((it) => (
                    <li
                      key={it.id}
                      className="flex items-center justify-between py-0.5"
                    >
                      <span>
                        <strong>{it.quantity}x</strong>{" "}
                        {lang === "ar"
                          ? it.productNameArSnapshot
                          : it.productNameFrSnapshot}{" "}
                        <span className="text-zinc-400">
                          ({it.unitPriceMadSnapshot} MAD/u)
                        </span>
                      </span>
                      <span className="font-mono font-bold">
                        {it.lineTotalMad} MAD
                      </span>
                    </li>
                  ))}
                </ul>

                {ord.orderNotes && (
                  <p className="text-xs font-bold text-[#FF5A00] bg-orange-50 px-3 py-2 rounded-lg">
                    Note du client : « {ord.orderNotes} »
                  </p>
                )}

                {/* Partner Order Actions */}
                {ord.status === "pending" && (
                  <div className="pt-2 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOrderStatus(ord.id, "accepted")}
                      className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      {t.partnerAcceptOrder}
                    </button>
                    <input
                      type="text"
                      placeholder="Motif si refus (ex: rupture)"
                      value={rejectReasons[ord.id] || ""}
                      onChange={(e) =>
                        setRejectReasons({
                          ...rejectReasons,
                          [ord.id]: e.target.value,
                        })
                      }
                      className="px-3 py-2 rounded-xl border border-zinc-300 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => handleOrderStatus(ord.id, "rejected")}
                      className="px-3.5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center gap-1.5"
                    >
                      <XCircle className="w-4 h-4" />
                      {t.partnerRejectOrder}
                    </button>
                  </div>
                )}

                {ord.status === "accepted" && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => handleOrderStatus(ord.id, "preparing")}
                      className="px-4 py-2.5 rounded-xl bg-[#FF5A00] hover:bg-[#E04F00] text-white font-bold text-xs flex items-center gap-1.5 shadow-xs"
                    >
                      <ChefHat className="w-4 h-4" />
                      {t.partnerStartPrep}
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Add Product Form */}
          <form
            onSubmit={handleAddProduct}
            className="bg-white rounded-2xl p-5 border border-zinc-200 space-y-3 h-fit"
          >
            <h3 className="font-extrabold text-base text-[#111111] flex items-center gap-2">
              <Plus className="w-4 h-4 text-[#FF5A00]" />
              {t.partnerAddProduct}
            </h3>
            <div>
              <label className="block text-xs font-bold text-zinc-700 mb-1">
                Nom du plat / produit (Français)
              </label>
              <input
                type="text"
                required
                value={newProdNameFr}
                onChange={(e) => setNewProdNameFr(e.target.value)}
                placeholder="ex: Tajine Kefta aux Oeufs"
                className="w-full px-3 py-2 rounded-xl border border-zinc-300 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-700 mb-1">
                Nom en Arabe (اختياري)
              </label>
              <input
                type="text"
                value={newProdNameAr}
                onChange={(e) => setNewProdNameAr(e.target.value)}
                placeholder="طاجين الكفتة بالبيض"
                dir="rtl"
                className="w-full px-3 py-2 rounded-xl border border-zinc-300 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Prix (MAD)
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={newProdPriceMad}
                  onChange={(e) => setNewProdPriceMad(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-300 text-xs font-mono font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Catégorie
                </label>
                <input
                  type="text"
                  value={newProdCatFr}
                  onChange={(e) => setNewProdCatFr(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-300 text-xs"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-700 mb-1">
                Description
              </label>
              <input
                type="text"
                value={newProdDescFr}
                onChange={(e) => setNewProdDescFr(e.target.value)}
                placeholder="Servi chaud avec pain Tafarnout..."
                className="w-full px-3 py-2 rounded-xl border border-zinc-300 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-700 mb-1">
                Image URL
              </label>
              <input
                type="url"
                value={newProdImage}
                onChange={(e) => setNewProdImage(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-zinc-300 text-xs"
              />
            </div>
            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-[#FF5A00] hover:bg-[#E04F00] text-white font-bold text-xs shadow-sm transition"
            >
              Ajouter au catalogue
            </button>
          </form>

          {/* Products List */}
          <div className="lg:col-span-2 space-y-3">
            {filteredProducts.map((prod) => (
              <div
                key={prod.id}
                className="bg-white rounded-2xl p-4 border border-zinc-200 flex flex-wrap items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={prod.imageUrl}
                    alt={prod.nameFr}
                    className="w-16 h-16 rounded-xl object-cover bg-zinc-100 shrink-0"
                  />
                  <div>
                    <h4 className="font-extrabold text-sm text-[#111111]">
                      {prod.nameFr}
                    </h4>
                    <p className="text-xs text-zinc-500" dir="rtl">
                      {prod.nameAr}
                    </p>
                    <span
                      className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        prod.isAvailable
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {prod.isAvailable ? "En stock" : "Épuisé"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center border border-zinc-300 rounded-xl px-2 py-1 bg-zinc-50">
                    <DollarSign className="w-3.5 h-3.5 text-zinc-400" />
                    <input
                      type="number"
                      min={1}
                      value={priceEdits[prod.id] ?? prod.priceMad}
                      onChange={(e) =>
                        setPriceEdits({
                          ...priceEdits,
                          [prod.id]: Number(e.target.value),
                        })
                      }
                      className="w-16 text-xs font-mono font-bold bg-transparent text-right focus:outline-none"
                    />
                    <span className="text-[11px] font-bold text-zinc-500 ml-1">
                      MAD
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      handleUpdateProduct(
                        prod.id,
                        prod.isAvailable,
                        priceEdits[prod.id] ?? prod.priceMad
                      )
                    }
                    className="px-3 py-2 rounded-xl bg-[#111111] hover:bg-zinc-800 text-white text-xs font-bold"
                  >
                    Sauver Prix
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleUpdateProduct(
                        prod.id,
                        !prod.isAvailable,
                        priceEdits[prod.id] ?? prod.priceMad
                      )
                    }
                    className={`px-3 py-2 rounded-xl text-xs font-bold ${
                      prod.isAvailable
                        ? "bg-amber-100 text-amber-900 hover:bg-amber-200"
                        : "bg-emerald-600 text-white hover:bg-emerald-700"
                    }`}
                  >
                    {prod.isAvailable ? "Marquer Épuisé" : "Remettre en stock"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
