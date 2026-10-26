"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  ShieldCheck,
  Bike,
  Store,
  MapPin,
  Tag,
  Award,
  Download,
  RefreshCw,
  CheckCircle2,
  Banknote,
  ClipboardList,
  Plus,
} from "lucide-react";
import { translations, type Lang } from "@/lib/i18n";

interface AdminDriver {
  id: number;
  fullName: string;
  email: string;
  phone: string;
  driverCode: string | null;
  vehiclePlate: string | null;
  isOnline: boolean;
  currentZone: string | null;
  activeOrdersCount: number;
  totalAssignedCount: number;
  codStats: {
    pendingExpectedMad: number;
    cashInHandByDriversMad: number;
    remittedToAdminMad: number;
    totalCollectedMad: number;
    totalDriverEarningsMad: number;
    completedDeliveriesCount: number;
  };
}

interface AdminShop {
  id: number;
  nameFr: string;
  nameAr: string;
  category: string;
  address: string;
  phone: string;
  commissionRate: number;
  isApproved: boolean;
  isOpen: boolean;
  deliveredCount: number;
  grossSalesMad: number;
  commissionMad: number;
  netPayoutMad: number;
}

interface AdminZone {
  id: number;
  nameFr: string;
  nameAr: string;
  slug: string;
  deliveryFeeMad: number;
  driverPayoutMad: number;
  estimatedMins: string;
  isActive: boolean;
}

interface AdminPromo {
  id: number;
  code: string;
  titleFr: string;
  titleAr: string;
  discountMad: number;
  minOrderMad: number;
  isActive: boolean;
  usageCount: number;
}

interface AdminCustomer {
  id: number;
  fullName: string;
  email: string;
  phone: string;
  ordersCount: number;
  stampsCount: number;
  pointsBalance: number;
  rewardsRedeemed: number;
}

interface AdminOrder {
  id: number;
  orderNumber: string;
  status: string;
  driverId: number | null;
  subtotalMad: number;
  deliveryFeeMad: number;
  discountMad: number;
  totalMad: number;
  commissionMad: number;
  partnerPayoutMad: number;
  driverEarningMad: number;
  customerNameSnapshot: string;
  customerPhoneSnapshot: string;
  deliveryZoneSnapshot: string;
  deliveryAddressSnapshot: string;
  shopNameSnapshot: string;
  paymentStatus: string;
  createdAt: string;
  items: Array<{
    id: number;
    productNameFrSnapshot: string;
    quantity: number;
    unitPriceMadSnapshot: number;
    lineTotalMad: number;
  }>;
}

export function AdminPortal({ lang }: { lang: Lang }) {
  const t = translations[lang];
  const [activeTab, setActiveTab] = useState<
    "dispatch" | "drivers" | "shops" | "zones" | "loyalty"
  >("dispatch");
  const [drivers, setDrivers] = useState<AdminDriver[]>([]);
  const [shops, setShops] = useState<AdminShop[]>([]);
  const [zones, setZones] = useState<AdminZone[]>([]);
  const [promotions, setPromotions] = useState<AdminPromo[]>([]);
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [summary, setSummary] = useState({
    totalOrdersCount: 0,
    deliveredOrdersCount: 0,
    pendingOrdersCount: 0,
    activeDeliveryCount: 0,
    totalGmvMad: 0,
    totalSubtotalsMad: 0,
    totalDeliveryFeesMad: 0,
    totalCommissionMad: 0,
    totalPartnerPayoutsMad: 0,
    cod: {
      pendingExpectedMad: 0,
      cashInHandByDriversMad: 0,
      remittedToAdminMad: 0,
      totalCollectedMad: 0,
      totalDriverEarningsMad: 0,
      completedDeliveriesCount: 0,
    },
  });
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState("");
  const [selectedDrivers, setSelectedDrivers] = useState<
    Record<number, number>
  >({});
  const [commissionInputs, setCommissionInputs] = useState<
    Record<number, number>
  >({});
  const [zoneEdits, setZoneEdits] = useState<
    Record<number, { fee: number; payout: number }>
  >({});

  // New zone & promo states
  const [newZoneNameFr, setNewZoneNameFr] = useState("");
  const [newZoneFee, setNewZoneFee] = useState("15");
  const [newZonePayout, setNewZonePayout] = useState("12");

  const [newPromoCode, setNewPromoCode] = useState("");
  const [newPromoTitle, setNewPromoTitle] = useState("");
  const [newPromoDiscount, setNewPromoDiscount] = useState("15");
  const [newPromoMin, setNewPromoMin] = useState("60");

  const loadAdminData = useCallback(async () => {
    setLoading(true);
    try {
      const [admRes, ordRes] = await Promise.all([
        fetch("/api/admin"),
        fetch("/api/orders"),
      ]);
      if (admRes.ok) {
        const data = await admRes.json();
        const drvList: AdminDriver[] = data.drivers || [];
        setDrivers(drvList);
        const shList: AdminShop[] = data.shops || [];
        setShops(shList);
        const commMap: Record<number, number> = {};
        shList.forEach((s) => {
          commMap[s.id] = s.commissionRate;
        });
        setCommissionInputs((prev) => ({ ...commMap, ...prev }));

        const zList: AdminZone[] = data.zones || [];
        setZones(zList);
        const zMap: Record<number, { fee: number; payout: number }> = {};
        zList.forEach((z) => {
          zMap[z.id] = {
            fee: z.deliveryFeeMad,
            payout: z.driverPayoutMad,
          };
        });
        setZoneEdits((prev) => ({ ...zMap, ...prev }));

        setPromotions(data.promotions || []);
        setCustomers(data.customers || []);
        if (data.summary) setSummary(data.summary);
      }
      if (ordRes.ok) {
        const ordData = await ordRes.json();
        setOrders(ordData.orders || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  function notify(msg: string) {
    setFeedback(msg);
    setTimeout(() => setFeedback(""), 3500);
  }

  async function handleAssignDriver(orderId: number) {
    const driverId = selectedDrivers[orderId] || drivers[0]?.id;
    if (!driverId) return;
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "assign_driver",
        orderId,
        driverId,
      }),
    });
    if (res.ok) {
      notify("Livreur moto assigné avec succès !");
      await loadAdminData();
    }
  }

  async function handleOverrideOrderStatus(orderId: number, status: string) {
    const res = await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      notify(`Statut commande mis à jour : ${status}`);
      await loadAdminData();
    }
  }

  async function handleSettleDriverCod(driverId: number, driverName: string) {
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "settle_driver_cod",
        driverId,
      }),
    });
    if (res.ok) {
      notify(`Cash COD de ${driverName} encaissé et réconcilié !`);
      await loadAdminData();
    }
  }

  async function handleUpdateShop(
    shopId: number,
    isApproved: boolean,
    commissionRate: number
  ) {
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_shop",
        shopId,
        isApproved,
        commissionRate,
      }),
    });
    if (res.ok) {
      notify("Commerce partenaire mis à jour !");
      await loadAdminData();
    }
  }

  async function handleUpdateZone(zoneId: number, isActive: boolean) {
    const edit = zoneEdits[zoneId];
    if (!edit) return;
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_zone",
        zoneId,
        deliveryFeeMad: edit.fee,
        driverPayoutMad: edit.payout,
        isActive,
      }),
    });
    if (res.ok) {
      notify("Tarif du quartier d'Agadir mis à jour !");
      await loadAdminData();
    }
  }

  async function handleCreateZone(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_zone",
        nameFr: newZoneNameFr,
        deliveryFeeMad: Number(newZoneFee),
        driverPayoutMad: Number(newZonePayout),
      }),
    });
    if (res.ok) {
      setNewZoneNameFr("");
      notify("Nouveau quartier ajouté à Agadir !");
      await loadAdminData();
    }
  }

  async function handleCreatePromo(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_promo",
        code: newPromoCode,
        titleFr: newPromoTitle,
        discountMad: Number(newPromoDiscount),
        minOrderMad: Number(newPromoMin),
      }),
    });
    if (res.ok) {
      setNewPromoCode("");
      setNewPromoTitle("");
      notify("Code promo créé !");
      await loadAdminData();
    }
  }

  async function handleGrantStamp(customerId: number, delta: number) {
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "grant_stamp",
        customerId,
        delta,
      }),
    });
    if (res.ok) {
      notify("Carte Fidélité 10 Tampons mise à jour !");
      await loadAdminData();
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Admin Command Center Header */}
      <div className="bg-[#111111] text-white rounded-2xl p-6 shadow-xl border border-zinc-800">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#FF5A00] flex items-center justify-center text-white shadow-md">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[11px] font-black uppercase tracking-wider text-[#FF5A00]">
                SOUK EXPRESS AGADIR • OPÉRATIONS & FINANCES
              </span>
              <h1 className="text-xl sm:text-2xl font-extrabold">
                {t.adminDashboardTitle}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <a
              href="/api/admin/export-csv"
              download="souk-express-agadir-orders.csv"
              className="px-4 py-2.5 rounded-xl bg-[#FF5A00] hover:bg-[#E04F00] text-white font-extrabold text-xs flex items-center gap-2 shadow-md transition"
            >
              <Download className="w-4 h-4" />
              {t.adminExportCsv}
            </a>
            <button
              type="button"
              onClick={loadAdminData}
              className="p-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white"
              title="Actualiser"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        </div>

        {/* Daily & Monthly Financial Summary Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-5">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
            <p className="text-[11px] text-zinc-400">Volume Livré (GMV)</p>
            <p className="text-lg font-black text-white font-mono">
              {summary.totalGmvMad} MAD
            </p>
            <span className="text-[10px] text-zinc-500">
              {summary.deliveredOrdersCount} livrées /{" "}
              {summary.totalOrdersCount} total
            </span>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
            <p className="text-[11px] text-zinc-400">Commission Souk Express</p>
            <p className="text-lg font-black text-[#FF5A00] font-mono">
              {summary.totalCommissionMad} MAD
            </p>
            <span className="text-[10px] text-zinc-500">
              Revenu net plateforme
            </span>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
            <p className="text-[11px] text-zinc-400">Reversement Commerces</p>
            <p className="text-lg font-black text-emerald-400 font-mono">
              {summary.totalPartnerPayoutsMad} MAD
            </p>
            <span className="text-[10px] text-zinc-500">Part partenaires</span>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
            <p className="text-[11px] text-zinc-400">Frais Livraison Perçus</p>
            <p className="text-lg font-black text-white font-mono">
              {summary.totalDeliveryFeesMad} MAD
            </p>
            <span className="text-[10px] text-zinc-500">
              Gains livreurs : {summary.cod.totalDriverEarningsMad} MAD
            </span>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
            <p className="text-[11px] text-amber-400 font-semibold">
              Cash COD chez Livreurs
            </p>
            <p className="text-lg font-black text-amber-400 font-mono">
              {summary.cod.cashInHandByDriversMad} MAD
            </p>
            <span className="text-[10px] text-zinc-500">
              À encaisser par l&apos;Admin
            </span>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
            <p className="text-[11px] text-emerald-400 font-semibold">
              Cash COD Réconcilié
            </p>
            <p className="text-lg font-black text-emerald-400 font-mono">
              {summary.cod.remittedToAdminMad} MAD
            </p>
            <span className="text-[10px] text-zinc-500">Déjà en caisse</span>
          </div>
        </div>
      </div>

      {feedback && (
        <div className="p-3.5 rounded-xl bg-emerald-600 text-white font-bold text-sm flex items-center gap-2 shadow-md">
          <CheckCircle2 className="w-5 h-5" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Admin Navigation Tabs */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("dispatch")}
          className={`px-4 py-2.5 rounded-xl font-extrabold text-xs flex items-center gap-2 transition ${
            activeTab === "dispatch"
              ? "bg-[#FF5A00] text-white shadow-sm"
              : "bg-white text-zinc-700 border border-zinc-200"
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          1. Dispatch & Commandes ({orders.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("drivers")}
          className={`px-4 py-2.5 rounded-xl font-extrabold text-xs flex items-center gap-2 transition ${
            activeTab === "drivers"
              ? "bg-[#FF5A00] text-white shadow-sm"
              : "bg-white text-zinc-700 border border-zinc-200"
          }`}
        >
          <Bike className="w-4 h-4" />
          2. Flotte 4 Livreurs Moto & Cash COD ({drivers.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("shops")}
          className={`px-4 py-2.5 rounded-xl font-extrabold text-xs flex items-center gap-2 transition ${
            activeTab === "shops"
              ? "bg-[#FF5A00] text-white shadow-sm"
              : "bg-white text-zinc-700 border border-zinc-200"
          }`}
        >
          <Store className="w-4 h-4" />
          3. Commerces & Commissions ({shops.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("zones")}
          className={`px-4 py-2.5 rounded-xl font-extrabold text-xs flex items-center gap-2 transition ${
            activeTab === "zones"
              ? "bg-[#FF5A00] text-white shadow-sm"
              : "bg-white text-zinc-700 border border-zinc-200"
          }`}
        >
          <MapPin className="w-4 h-4" />
          4. Quartiers Agadir & Frais ({zones.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("loyalty")}
          className={`px-4 py-2.5 rounded-xl font-extrabold text-xs flex items-center gap-2 transition ${
            activeTab === "loyalty"
              ? "bg-[#FF5A00] text-white shadow-sm"
              : "bg-white text-zinc-700 border border-zinc-200"
          }`}
        >
          <Award className="w-4 h-4" />
          5. Promos & Carte 10 Tampons
        </button>
      </div>

      {/* TAB 1: DISPATCH & ORDERS */}
      {activeTab === "dispatch" && (
        <div className="space-y-4">
          {orders.map((ord) => {
            const currentDriver = drivers.find((d) => d.id === ord.driverId);
            return (
              <div
                key={ord.id}
                className="bg-white rounded-2xl p-5 border border-zinc-200 shadow-xs space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-zinc-100">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-3 py-1 rounded-lg bg-[#111111] text-white font-mono font-black text-xs">
                      {ord.orderNumber}
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-orange-50 text-[#FF5A00] font-extrabold text-xs uppercase">
                      {ord.status}
                    </span>
                    <span className="text-xs font-bold text-zinc-800">
                      {ord.shopNameSnapshot} → {ord.customerNameSnapshot}
                    </span>
                    <span className="text-xs text-zinc-500">
                      ({ord.deliveryZoneSnapshot})
                    </span>
                  </div>

                  <div className="flex items-center gap-4 font-mono text-xs">
                    <span>Sous-total: {ord.subtotalMad} MAD</span>
                    <span>Livraison: {ord.deliveryFeeMad} MAD</span>
                    <span className="text-sm font-black text-[#FF5A00]">
                      Total COD: {ord.totalMad} MAD
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                  <div className="text-xs text-zinc-600 space-y-1">
                    <p>
                      <strong>Adresse :</strong> {ord.deliveryAddressSnapshot} (
                      {ord.customerPhoneSnapshot})
                    </p>
                    <p>
                      <strong>Articles :</strong>{" "}
                      {ord.items
                        .map(
                          (i) =>
                            `${i.quantity}x ${i.productNameFrSnapshot} (${i.unitPriceMadSnapshot} MAD)`
                        )
                        .join(", ")}
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      Commission Souk Express:{" "}
                      <strong>{ord.commissionMad} MAD</strong> • Reversement
                      Commerce: <strong>{ord.partnerPayoutMad} MAD</strong> •
                      Gain Livreur: <strong>{ord.driverEarningMad} MAD</strong>
                    </p>
                  </div>

                  {/* Manual Driver Assignment Box */}
                  <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex-1 min-w-[200px]">
                      <label className="block text-[11px] font-extrabold text-zinc-700 mb-1">
                        Assigner manuellement à l&apos;un des 4 livreurs moto :
                      </label>
                      <select
                        value={
                          selectedDrivers[ord.id] ??
                          ord.driverId ??
                          drivers[0]?.id ??
                          ""
                        }
                        onChange={(e) =>
                          setSelectedDrivers({
                            ...selectedDrivers,
                            [ord.id]: Number(e.target.value),
                          })
                        }
                        className="w-full px-3 py-2 rounded-xl border border-zinc-300 bg-white text-xs font-bold"
                      >
                        {drivers.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.driverCode} • {d.fullName} (
                            {d.isOnline ? "En ligne" : "Hors ligne"} •{" "}
                            {d.activeOrdersCount} courses)
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleAssignDriver(ord.id)}
                      className="px-4 py-2.5 rounded-xl bg-[#FF5A00] hover:bg-[#E04F00] text-white font-extrabold text-xs shadow-xs"
                    >
                      Assigner Moto
                    </button>

                    <select
                      value={ord.status}
                      onChange={(e) =>
                        handleOverrideOrderStatus(ord.id, e.target.value)
                      }
                      className="px-2.5 py-2 rounded-xl border border-zinc-300 bg-white text-xs font-semibold"
                      title="Forcer statut (Admin)"
                    >
                      <option value="pending">pending</option>
                      <option value="accepted">accepted</option>
                      <option value="preparing">preparing</option>
                      <option value="assigned">assigned</option>
                      <option value="picked_up">picked_up</option>
                      <option value="on_the_way">on_the_way</option>
                      <option value="delivered">delivered</option>
                      <option value="cancelled">cancelled</option>
                    </select>
                  </div>
                </div>

                {currentDriver && (
                  <div className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
                    <Bike className="w-4 h-4" />
                    Actuellement assignée à :{" "}
                    <strong>
                      {currentDriver.driverCode} — {currentDriver.fullName}
                    </strong>{" "}
                    ({currentDriver.vehiclePlate})
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 2: 4 MOTORCYCLE DRIVERS & COD CASH RECONCILIATION */}
      {activeTab === "drivers" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {drivers.map((drv) => (
            <div
              key={drv.id}
              className="bg-white rounded-2xl p-5 border border-zinc-200 shadow-xs space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#111111] text-[#FF5A00] flex items-center justify-center font-black text-sm font-mono">
                    {drv.driverCode}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold text-base text-[#111111]">
                        {drv.fullName}
                      </h3>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          drv.isOnline
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-zinc-200 text-zinc-700"
                        }`}
                      >
                        {drv.isOnline ? "En ligne" : "Hors ligne"}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500">
                      Matricule : <strong>{drv.vehiclePlate}</strong> •{" "}
                      {drv.phone}
                    </p>
                    <p className="text-xs text-zinc-500">
                      Secteur : <strong>{drv.currentZone}</strong>
                    </p>
                  </div>
                </div>

                <div className="text-right font-mono">
                  <span className="text-xs text-zinc-500 block">
                    Courses actives
                  </span>
                  <span className="text-lg font-black text-[#111111]">
                    {drv.activeOrdersCount}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 bg-zinc-50 p-3 rounded-xl border border-zinc-200 text-center font-mono">
                <div>
                  <span className="text-[10px] text-zinc-500 block">
                    Cash en main (COD)
                  </span>
                  <span className="text-sm font-black text-[#FF5A00]">
                    {drv.codStats.cashInHandByDriversMad} MAD
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 block">
                    Déjà remis Admin
                  </span>
                  <span className="text-sm font-black text-emerald-600">
                    {drv.codStats.remittedToAdminMad} MAD
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 block">
                    Gains Livreur
                  </span>
                  <span className="text-sm font-black text-zinc-900">
                    {drv.codStats.totalDriverEarningsMad} MAD
                  </span>
                </div>
              </div>

              {drv.codStats.cashInHandByDriversMad > 0 ? (
                <button
                  type="button"
                  onClick={() => handleSettleDriverCod(drv.id, drv.fullName)}
                  className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-sm transition"
                >
                  <Banknote className="w-4 h-4" />
                  Encaisser & Réconcilier {drv.codStats.cashInHandByDriversMad}{" "}
                  MAD en caisse Admin
                </button>
              ) : (
                <div className="py-2.5 px-3 rounded-xl bg-zinc-100 text-zinc-500 text-xs font-semibold text-center">
                  Aucun cash COD en attente de remise pour ce livreur
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* TAB 3: SHOPS, APPROVAL & COMMISSIONS */}
      {activeTab === "shops" && (
        <div className="space-y-3">
          {shops.map((sh) => (
            <div
              key={sh.id}
              className="bg-white rounded-2xl p-5 border border-zinc-200 flex flex-wrap items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-base text-[#111111]">
                    {sh.nameFr}
                  </h3>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold ${
                      sh.isApproved
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-900"
                    }`}
                  >
                    {sh.isApproved
                      ? "Approuvé"
                      : "En attente d'approbation Admin"}
                  </span>
                </div>
                <p className="text-xs text-zinc-500">
                  {sh.address} • {sh.phone} • Catégorie : {sh.category}
                </p>
                <div className="flex flex-wrap gap-4 text-xs font-mono pt-1">
                  <span>
                    Ventes livrées : <strong>{sh.grossSalesMad} MAD</strong>
                  </span>
                  <span className="text-[#FF5A00]">
                    Commission Souk Express :{" "}
                    <strong>{sh.commissionMad} MAD</strong>
                  </span>
                  <span className="text-emerald-600">
                    Reversement Net Partenaire :{" "}
                    <strong>{sh.netPayoutMad} MAD</strong>
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <div className="flex items-center gap-1.5 bg-zinc-50 border border-zinc-300 rounded-xl px-3 py-1.5">
                  <span className="text-xs font-bold text-zinc-600">
                    Commission % :
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    value={commissionInputs[sh.id] ?? sh.commissionRate}
                    onChange={(e) =>
                      setCommissionInputs({
                        ...commissionInputs,
                        [sh.id]: Number(e.target.value),
                      })
                    }
                    className="w-14 text-xs font-mono font-black text-right bg-transparent focus:outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={() =>
                    handleUpdateShop(
                      sh.id,
                      sh.isApproved,
                      commissionInputs[sh.id] ?? sh.commissionRate
                    )
                  }
                  className="px-3.5 py-2 rounded-xl bg-[#111111] text-white text-xs font-bold"
                >
                  Sauver %
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleUpdateShop(
                      sh.id,
                      !sh.isApproved,
                      commissionInputs[sh.id] ?? sh.commissionRate
                    )
                  }
                  className={`px-4 py-2 rounded-xl text-xs font-extrabold transition ${
                    sh.isApproved
                      ? "bg-red-100 text-red-800 hover:bg-red-200"
                      : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
                  }`}
                >
                  {sh.isApproved ? "Suspendre" : "Approuver ce commerce"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 4: AGADIR SERVICE ZONES & DELIVERY FEES */}
      {activeTab === "zones" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form
            onSubmit={handleCreateZone}
            className="bg-white rounded-2xl p-5 border border-zinc-200 space-y-3 h-fit"
          >
            <h3 className="font-extrabold text-base text-[#111111] flex items-center gap-2">
              <Plus className="w-4 h-4 text-[#FF5A00]" />
              Ajouter un Quartier d&apos;Agadir
            </h3>
            <div>
              <label className="block text-xs font-bold text-zinc-700 mb-1">
                Nom du quartier
              </label>
              <input
                type="text"
                required
                value={newZoneNameFr}
                onChange={(e) => setNewZoneNameFr(e.target.value)}
                placeholder="ex: Bensergao ou El Houda"
                className="w-full px-3 py-2 rounded-xl border border-zinc-300 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Frais Client (MAD)
                </label>
                <input
                  type="number"
                  min={0}
                  required
                  value={newZoneFee}
                  onChange={(e) => setNewZoneFee(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-300 text-xs font-mono font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Gain Livreur (MAD)
                </label>
                <input
                  type="number"
                  min={0}
                  required
                  value={newZonePayout}
                  onChange={(e) => setNewZonePayout(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-300 text-xs font-mono font-bold"
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-[#FF5A00] hover:bg-[#E04F00] text-white font-bold text-xs"
            >
              Ajouter le quartier
            </button>
          </form>

          <div className="lg:col-span-2 space-y-2.5">
            {zones.map((z) => (
              <div
                key={z.id}
                className="bg-white rounded-2xl p-4 border border-zinc-200 flex flex-wrap items-center justify-between gap-3"
              >
                <div>
                  <h4 className="font-extrabold text-sm text-[#111111]">
                    {z.nameFr}
                  </h4>
                  <p className="text-xs text-zinc-500">
                    {z.nameAr} • Délai estimé : {z.estimatedMins}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1 bg-zinc-50 border border-zinc-300 rounded-xl px-2.5 py-1.5">
                    <span className="text-[11px] text-zinc-500">
                      Client MAD:
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={zoneEdits[z.id]?.fee ?? z.deliveryFeeMad}
                      onChange={(e) =>
                        setZoneEdits({
                          ...zoneEdits,
                          [z.id]: {
                            fee: Number(e.target.value),
                            payout: zoneEdits[z.id]?.payout ?? z.driverPayoutMad,
                          },
                        })
                      }
                      className="w-12 text-xs font-mono font-black text-right bg-transparent"
                    />
                  </div>

                  <div className="flex items-center gap-1 bg-zinc-50 border border-zinc-300 rounded-xl px-2.5 py-1.5">
                    <span className="text-[11px] text-zinc-500">
                      Livreur MAD:
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={zoneEdits[z.id]?.payout ?? z.driverPayoutMad}
                      onChange={(e) =>
                        setZoneEdits({
                          ...zoneEdits,
                          [z.id]: {
                            fee: zoneEdits[z.id]?.fee ?? z.deliveryFeeMad,
                            payout: Number(e.target.value),
                          },
                        })
                      }
                      className="w-12 text-xs font-mono font-black text-right bg-transparent"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => handleUpdateZone(z.id, z.isActive)}
                    className="px-3.5 py-2 rounded-xl bg-[#111111] text-white text-xs font-bold"
                  >
                    Enregistrer
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: PROMOTIONS & 10-STAMP LOYALTY CARD */}
      {activeTab === "loyalty" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Promotions Manager */}
          <div className="space-y-4">
            <form
              onSubmit={handleCreatePromo}
              className="bg-white rounded-2xl p-5 border border-zinc-200 space-y-3"
            >
              <h3 className="font-extrabold text-base text-[#111111] flex items-center gap-2">
                <Tag className="w-4 h-4 text-[#FF5A00]" />
                Créer un Code Promo Souk Express
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  required
                  value={newPromoCode}
                  onChange={(e) =>
                    setNewPromoCode(e.target.value.toUpperCase())
                  }
                  placeholder="Code (ex: RAMADAN25)"
                  className="px-3 py-2 rounded-xl border border-zinc-300 text-xs font-mono font-bold"
                />
                <input
                  type="text"
                  required
                  value={newPromoTitle}
                  onChange={(e) => setNewPromoTitle(e.target.value)}
                  placeholder="Titre promo"
                  className="px-3 py-2 rounded-xl border border-zinc-300 text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-600 mb-1">
                    Réduction (MAD)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={newPromoDiscount}
                    onChange={(e) => setNewPromoDiscount(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-300 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-zinc-600 mb-1">
                    Commande min. (MAD)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={newPromoMin}
                    onChange={(e) => setNewPromoMin(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-300 text-xs font-mono"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-[#FF5A00] text-white font-bold text-xs"
              >
                Créer le Code Promo
              </button>
            </form>

            <div className="space-y-2">
              {promotions.map((p) => (
                <div
                  key={p.id}
                  className="bg-white rounded-xl p-4 border border-zinc-200 flex items-center justify-between"
                >
                  <div>
                    <span className="px-2.5 py-1 rounded-lg bg-orange-50 text-[#FF5A00] font-mono font-black text-xs">
                      {p.code}
                    </span>
                    <p className="text-xs font-bold text-zinc-800 mt-1">
                      {p.titleFr}
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      -{p.discountMad} MAD dès {p.minOrderMad} MAD • Utilisé{" "}
                      {p.usageCount} fois
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 10-Stamp Loyalty Card Manager */}
          <div className="bg-white rounded-2xl p-5 border border-zinc-200 space-y-4 h-fit">
            <h3 className="font-extrabold text-base text-[#111111] flex items-center gap-2">
              <Award className="w-5 h-5 text-[#FF5A00]" />
              Clients & Carte Fidélité 10 Tampons
            </h3>
            <p className="text-xs text-zinc-500">
              Chaque commande livrée ajoute automatiquement +1 tampon. À 10
              tampons, le client bénéficie de -25 MAD sur sa commande suivante.
            </p>
            <div className="space-y-3">
              {customers.map((c) => (
                <div
                  key={c.id}
                  className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-extrabold text-sm text-[#111111]">
                        {c.fullName}
                      </h4>
                      <p className="text-xs text-zinc-500">
                        {c.email} • {c.phone}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleGrantStamp(c.id, -1)}
                        className="px-2.5 py-1 rounded-lg bg-zinc-200 hover:bg-zinc-300 text-xs font-bold"
                      >
                        -1
                      </button>
                      <span className="px-3 py-1 rounded-lg bg-[#111111] text-[#FF5A00] font-mono font-black text-xs">
                        {c.stampsCount} / 10 tampons
                      </span>
                      <button
                        type="button"
                        onClick={() => handleGrantStamp(c.id, 1)}
                        className="px-2.5 py-1 rounded-lg bg-[#FF5A00] text-white text-xs font-bold"
                      >
                        +1 Tampon
                      </button>
                    </div>
                  </div>

                  {/* Visual 10 stamps bar */}
                  <div className="grid grid-cols-10 gap-1.5">
                    {Array.from({ length: 10 }).map((_, idx) => {
                      const filled = idx < c.stampsCount;
                      return (
                        <div
                          key={idx}
                          className={`h-7 rounded-lg flex items-center justify-center text-[10px] font-black border ${
                            filled
                              ? "bg-[#FF5A00] text-white border-[#FF5A00]"
                              : "bg-white text-zinc-400 border-zinc-200"
                          }`}
                        >
                          {filled ? "★" : idx + 1}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
