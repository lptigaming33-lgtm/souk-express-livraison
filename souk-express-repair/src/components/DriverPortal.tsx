"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Bike,
  MapPin,
  Phone,
  Navigation,
  CheckCircle2,
  Banknote,
  Power,
  RefreshCw,
  PackageCheck,
  Clock,
  MessageCircle,
} from "lucide-react";
import { translations, type Lang } from "@/lib/i18n";

interface OrderItemSnapshot {
  id: number;
  productNameFrSnapshot: string;
  productNameArSnapshot: string;
  unitPriceMadSnapshot: number;
  quantity: number;
  lineTotalMad: number;
}

interface DriverOrder {
  id: number;
  orderNumber: string;
  status: string;
  subtotalMad: number;
  deliveryFeeMad: number;
  discountMad: number;
  totalMad: number;
  driverEarningMad: number;
  deliveryAddressSnapshot: string;
  deliveryZoneSnapshot: string;
  deliveryLandmarkSnapshot: string;
  customerNameSnapshot: string;
  customerPhoneSnapshot: string;
  shopNameSnapshot: string;
  shopAddressSnapshot: string;
  shopPhoneSnapshot: string;
  orderNotes: string;
  paymentStatus: string;
  createdAt: string;
  items: OrderItemSnapshot[];
  assignment: {
    status: string;
    acknowledgedAt: string | null;
    pickedUpAt: string | null;
    onTheWayAt: string | null;
    deliveredAt: string | null;
  } | null;
  codRecord: {
    expectedAmountMad: number;
    collectedAmountMad: number;
    status: string;
  } | null;
}

interface DriverSummary {
  pendingExpectedMad: number;
  cashInHandByDriversMad: number;
  remittedToAdminMad: number;
  totalCollectedMad: number;
  totalDriverEarningsMad: number;
  completedDeliveriesCount: number;
}

interface DriverPortalProps {
  lang: Lang;
  user: {
    id: number;
    fullName: string;
    email: string;
    phone: string;
    driverCode: string | null;
    vehiclePlate: string | null;
    isOnline: boolean;
    currentZone: string | null;
  };
  onUserUpdated: () => void;
}

export function DriverPortal({
  lang,
  user,
  onUserUpdated,
}: DriverPortalProps) {
  const t = translations[lang];
  const [orders, setOrders] = useState<DriverOrder[]>([]);
  const [summary, setSummary] = useState<DriverSummary>({
    pendingExpectedMad: 0,
    cashInHandByDriversMad: 0,
    remittedToAdminMad: 0,
    totalCollectedMad: 0,
    totalDriverEarningsMad: 0,
    completedDeliveriesCount: 0,
  });
  const [isOnline, setIsOnline] = useState(user.isOnline);
  const [currentZone, setCurrentZone] = useState(
    user.currentZone || "Talborjt (Centre-Ville)"
  );
  const [loading, setLoading] = useState(true);
  const [busyOrderId, setBusyOrderId] = useState<number | null>(null);
  const [codInputs, setCodInputs] = useState<Record<number, number>>({});
  const [feedback, setFeedback] = useState("");

  const loadDriverData = useCallback(async () => {
    setLoading(true);
    try {
      const [ordRes, drvRes] = await Promise.all([
        fetch("/api/orders"),
        fetch("/api/driver"),
      ]);
      if (ordRes.ok) {
        const ordData = await ordRes.json();
        const list: DriverOrder[] = ordData.orders || [];
        setOrders(list);
        const initialCod: Record<number, number> = {};
        list.forEach((o) => {
          initialCod[o.id] = o.totalMad;
        });
        setCodInputs((prev) => ({ ...initialCod, ...prev }));
      }
      if (drvRes.ok) {
        const drvData = await drvRes.json();
        if (drvData.summary) setSummary(drvData.summary);
        if (drvData.driver) {
          setIsOnline(drvData.driver.isOnline);
          setCurrentZone(drvData.driver.currentZone || "Talborjt");
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDriverData();
  }, [loadDriverData, user.id]);

  async function handleToggleOnline(nextState: boolean, nextZone?: string) {
    setIsOnline(nextState);
    if (nextZone) setCurrentZone(nextZone);
    await fetch("/api/driver", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        isOnline: nextState,
        currentZone: nextZone ?? currentZone,
      }),
    });
    onUserUpdated();
  }

  async function handleAcknowledge(orderId: number) {
    setBusyOrderId(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "acknowledge" }),
      });
      if (res.ok) {
        setFeedback("Prise en charge confirmée !");
        await loadDriverData();
      }
    } finally {
      setBusyOrderId(null);
      setTimeout(() => setFeedback(""), 3000);
    }
  }

  async function handleStatusUpdate(
    orderId: number,
    nextStatus: "picked_up" | "on_the_way" | "delivered"
  ) {
    setBusyOrderId(orderId);
    try {
      const collectedAmountMad = codInputs[orderId];
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: nextStatus,
          collectedAmountMad,
          codNotes: "Encaissé en espèces par le livreur moto à Agadir",
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback(
          nextStatus === "delivered"
            ? `Livraison confirmée & ${collectedAmountMad} MAD enregistrés !`
            : "Statut de la course mis à jour !"
        );
        await loadDriverData();
      } else {
        setFeedback(data.error || "Erreur lors de la mise à jour");
      }
    } finally {
      setBusyOrderId(null);
      setTimeout(() => setFeedback(""), 3500);
    }
  }

  const activeOrders = orders.filter((o) =>
    ["assigned", "picked_up", "on_the_way"].includes(o.status)
  );
  const completedOrders = orders.filter((o) => o.status === "delivered");

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {/* High-Contrast Driver Cockpit Header */}
      <div className="rounded-2xl bg-[#111111] text-white p-5 shadow-xl border border-zinc-800">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-13 h-13 rounded-2xl bg-[#FF5A00] flex items-center justify-center text-white shadow-md">
              <Bike className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-[#FF5A00] text-white text-xs font-black font-mono">
                  {user.driverCode || "MOTO-AGADIR"}
                </span>
                <span className="text-xs text-zinc-400 font-mono">
                  {user.vehiclePlate || "Agadir Moto"}
                </span>
              </div>
              <h1 className="text-xl font-extrabold mt-0.5">{user.fullName}</h1>
              <p className="text-xs text-zinc-400">{t.driverConsoleTitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleToggleOnline(!isOnline)}
              className={`px-4 py-3 rounded-xl font-extrabold text-xs flex items-center gap-2 transition shadow-md ${
                isOnline
                  ? "bg-emerald-500 text-white hover:bg-emerald-600"
                  : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              }`}
            >
              <Power className="w-4 h-4" />
              {isOnline ? t.driverOnline : t.driverOffline}
            </button>

            <button
              type="button"
              onClick={loadDriverData}
              className="p-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
              title="Actualiser"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        </div>

        {/* Zone selector for driver */}
        <div className="mt-4 pt-4 border-t border-zinc-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-zinc-300">
            <MapPin className="w-4 h-4 text-[#FF5A00]" />
            <span>Secteur actuel à Agadir :</span>
          </div>
          <select
            value={currentZone}
            onChange={(e) => handleToggleOnline(isOnline, e.target.value)}
            className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-xs font-bold"
          >
            <option value="Talborjt (Centre-Ville)">
              Talborjt (Centre-Ville)
            </option>
            <option value="Souk El Had & Al Inbiaat">
              Souk El Had & Al Inbiaat
            </option>
            <option value="Hay Dakhla (Université)">
              Hay Dakhla (Université)
            </option>
            <option value="Founty & Marina d'Agadir">
              Founty & Marina d&apos;Agadir
            </option>
            <option value="Hay Salam & Jet Sakane">
              Hay Salam & Jet Sakane
            </option>
            <option value="Hay Mohammadi">Hay Mohammadi</option>
            <option value="Anza (Corniche Nord)">Anza (Corniche Nord)</option>
          </select>
        </div>

        {/* Daily Metrics */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-3">
            <p className="text-[11px] text-zinc-400 font-semibold">
              {t.driverDailyDeliveries}
            </p>
            <p className="text-xl font-black text-white font-mono mt-0.5">
              {summary.completedDeliveriesCount}
            </p>
          </div>
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-3">
            <p className="text-[11px] text-zinc-400 font-semibold">
              {t.driverEarnings}
            </p>
            <p className="text-xl font-black text-emerald-400 font-mono mt-0.5">
              {summary.totalDriverEarningsMad} MAD
            </p>
          </div>
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-3">
            <p className="text-[11px] text-zinc-400 font-semibold">
              {t.driverCashInHand}
            </p>
            <p className="text-xl font-black text-[#FF5A00] font-mono mt-0.5">
              {summary.cashInHandByDriversMad} MAD
            </p>
          </div>
        </div>
      </div>

      {feedback && (
        <div className="p-3.5 rounded-xl bg-emerald-600 text-white font-bold text-sm flex items-center gap-2 shadow-md">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Active Assigned Orders */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-[#111111] flex items-center gap-2">
            <Clock className="w-5 h-5 text-[#FF5A00]" />
            {t.driverAssignedOrders} ({activeOrders.length})
          </h2>
          <span className="text-xs font-semibold text-zinc-500">
            Commandes assignées uniquement à vous
          </span>
        </div>

        {activeOrders.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-zinc-200">
            <Bike className="w-10 h-10 text-zinc-400 mx-auto mb-2" />
            <p className="font-bold text-zinc-800">
              Aucune course active en ce moment
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              Restez « En ligne » : dès que l&apos;administrateur vous assigne
              une commande à Agadir, elle s&apos;affiche ici.
            </p>
          </div>
        ) : (
          activeOrders.map((ord) => {
            const pickupMapUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
              `${ord.shopNameSnapshot}, ${ord.shopAddressSnapshot}, Agadir, Morocco`
            )}`;
            const deliveryMapUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
              `${ord.deliveryAddressSnapshot}, ${ord.deliveryZoneSnapshot}, Agadir, Morocco`
            )}`;
            const customerWhatsappUrl = `https://wa.me/${ord.customerPhoneSnapshot.replace(
              /[^0-9]/g,
              ""
            )}?text=${encodeURIComponent(
              `Salam ${ord.customerNameSnapshot}, je suis votre livreur Souk Express (${user.fullName}) pour la commande ${ord.orderNumber} (${ord.totalMad} MAD).`
            )}`;

            return (
              <div
                key={ord.id}
                className="bg-white rounded-2xl border-2 border-[#FF5A00] shadow-lg overflow-hidden"
              >
                {/* Order Top Banner */}
                <div className="bg-[#111111] text-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="px-3 py-1 rounded-lg bg-[#FF5A00] text-white font-black text-sm font-mono">
                      {ord.orderNumber}
                    </span>
                    <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-zinc-800 text-amber-400">
                      {ord.status === "assigned"
                        ? "1. À récupérer au commerce"
                        : ord.status === "picked_up"
                          ? "2. Colis récupéré"
                          : "3. En route vers le client"}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-zinc-400 block">
                      Cash à encaisser (COD)
                    </span>
                    <span className="text-lg font-black text-[#FF5A00] font-mono">
                      {ord.totalMad} MAD
                    </span>
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  {/* Step 1: Pickup from Partner Shop */}
                  <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[11px] font-extrabold uppercase text-[#FF5A00]">
                          Étape 1 • Retrait Commerce (Pickup)
                        </span>
                        <h3 className="font-extrabold text-base text-[#111111]">
                          {ord.shopNameSnapshot}
                        </h3>
                        <p className="text-xs text-zinc-600">
                          {ord.shopAddressSnapshot}
                        </p>
                      </div>
                      <a
                        href={`tel:${ord.shopPhoneSnapshot}`}
                        className="p-2.5 rounded-xl bg-zinc-200 hover:bg-zinc-300 text-[#111111]"
                        title="Appeler le commerce"
                      >
                        <Phone className="w-4 h-4" />
                      </a>
                    </div>

                    <a
                      href={pickupMapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2.5 px-3 rounded-xl bg-[#111111] hover:bg-zinc-800 text-white text-xs font-bold flex items-center justify-center gap-2 transition"
                    >
                      <Navigation className="w-4 h-4 text-[#FF5A00]" />
                      {t.openGoogleMapsPickup}
                    </a>
                  </div>

                  {/* Step 2: Delivery to Customer in Agadir */}
                  <div className="p-4 rounded-xl bg-orange-50/60 border border-orange-200 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[11px] font-extrabold uppercase text-emerald-700">
                          Étape 2 • Livraison Client ({ord.deliveryZoneSnapshot})
                        </span>
                        <h3 className="font-extrabold text-base text-[#111111]">
                          {ord.customerNameSnapshot}
                        </h3>
                        <p className="text-xs font-semibold text-zinc-800">
                          {ord.deliveryAddressSnapshot}
                        </p>
                        {ord.deliveryLandmarkSnapshot && (
                          <p className="text-xs text-zinc-600 mt-0.5">
                            Repère : {ord.deliveryLandmarkSnapshot}
                          </p>
                        )}
                        {ord.orderNotes && (
                          <p className="text-xs font-bold text-[#FF5A00] mt-1">
                            Note : « {ord.orderNotes} »
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <a
                          href={`tel:${ord.customerPhoneSnapshot}`}
                          className="p-2.5 rounded-xl bg-white border border-zinc-300 text-[#111111]"
                          title="Appeler le client"
                        >
                          <Phone className="w-4 h-4" />
                        </a>
                        <a
                          href={customerWhatsappUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2.5 rounded-xl bg-emerald-600 text-white"
                          title="WhatsApp Client"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </a>
                      </div>
                    </div>

                    <a
                      href={deliveryMapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2.5 px-3 rounded-xl bg-[#FF5A00] hover:bg-[#E04F00] text-white text-xs font-bold flex items-center justify-center gap-2 transition shadow-xs"
                    >
                      <Navigation className="w-4 h-4" />
                      {t.openGoogleMapsDelivery}
                    </a>
                  </div>

                  {/* Items to verify */}
                  <div className="text-xs bg-zinc-50 rounded-xl p-3 border border-zinc-200">
                    <p className="font-bold text-zinc-700 mb-1.5">
                      Articles à vérifier au retrait :
                    </p>
                    <ul className="space-y-1 text-zinc-600">
                      {ord.items.map((item) => (
                        <li
                          key={item.id}
                          className="flex items-center justify-between"
                        >
                          <span>
                            <strong>{item.quantity}x</strong>{" "}
                            {lang === "ar"
                              ? item.productNameArSnapshot
                              : item.productNameFrSnapshot}
                          </span>
                          <span className="font-mono font-semibold">
                            {item.lineTotalMad} MAD
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Driver Action Buttons */}
                  <div className="pt-2 space-y-2.5">
                    {ord.status === "assigned" && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {!ord.assignment?.acknowledgedAt && (
                          <button
                            type="button"
                            disabled={busyOrderId === ord.id}
                            onClick={() => handleAcknowledge(ord.id)}
                            className="py-3.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs flex items-center justify-center gap-2"
                          >
                            <CheckCircle2 className="w-4 h-4 text-[#FF5A00]" />
                            {t.acknowledgeOrder}
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={busyOrderId === ord.id}
                          onClick={() =>
                            handleStatusUpdate(ord.id, "picked_up")
                          }
                          className="py-3.5 px-4 rounded-xl bg-[#FF5A00] hover:bg-[#E04F00] text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-md sm:col-span-2"
                        >
                          <PackageCheck className="w-5 h-5" />
                          {t.markPickedUp}
                        </button>
                      </div>
                    )}

                    {ord.status === "picked_up" && (
                      <button
                        type="button"
                        disabled={busyOrderId === ord.id}
                        onClick={() => handleStatusUpdate(ord.id, "on_the_way")}
                        className="w-full py-4 px-4 rounded-xl bg-[#FF5A00] hover:bg-[#E04F00] text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-md"
                      >
                        <Bike className="w-5 h-5" />
                        {t.markOnTheWay}
                      </button>
                    )}

                    {(ord.status === "on_the_way" ||
                      ord.status === "picked_up") && (
                      <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-extrabold text-emerald-950 flex items-center gap-1.5">
                            <Banknote className="w-4 h-4 text-emerald-600" />
                            Montant Cash reçu du client (MAD) :
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={codInputs[ord.id] ?? ord.totalMad}
                            onChange={(e) =>
                              setCodInputs({
                                ...codInputs,
                                [ord.id]: Number(e.target.value),
                              })
                            }
                            className="w-28 px-3 py-1.5 rounded-lg border border-emerald-400 bg-white font-mono font-black text-sm text-right"
                          />
                        </div>
                        <button
                          type="button"
                          disabled={busyOrderId === ord.id}
                          onClick={() =>
                            handleStatusUpdate(ord.id, "delivered")
                          }
                          className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-md transition"
                        >
                          <CheckCircle2 className="w-5 h-5" />
                          {t.markDeliveredAndCod} (
                          {codInputs[ord.id] ?? ord.totalMad} MAD)
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </section>

      {/* Completed Deliveries History */}
      <section className="space-y-3">
        <h3 className="text-base font-extrabold text-[#111111]">
          Historique de mes livraisons terminées ({completedOrders.length})
        </h3>
        {completedOrders.length === 0 ? (
          <p className="text-xs text-zinc-500">
            Aucune livraison terminée pour le moment.
          </p>
        ) : (
          <div className="space-y-2.5">
            {completedOrders.map((ord) => (
              <div
                key={ord.id}
                className="bg-white rounded-xl p-4 border border-zinc-200 flex items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-xs px-2 py-0.5 rounded-md bg-zinc-100">
                      {ord.orderNumber}
                    </span>
                    <span className="font-bold text-sm text-[#111111]">
                      {ord.shopNameSnapshot} → {ord.customerNameSnapshot}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {ord.deliveryZoneSnapshot} • Gain course :{" "}
                    <strong className="text-emerald-600">
                      +{ord.driverEarningMad} MAD
                    </strong>
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-mono font-black text-sm text-[#111111] block">
                    {ord.codRecord?.collectedAmountMad ?? ord.totalMad} MAD
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      ord.codRecord?.status === "remitted_to_admin"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {ord.codRecord?.status === "remitted_to_admin"
                      ? "Remis à l'Admin"
                      : "Cash en main"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
