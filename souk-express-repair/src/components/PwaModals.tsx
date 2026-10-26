"use client";

import React, { useState } from "react";
import {
  X,
  Smartphone,
  CheckCircle2,
  ShieldCheck,
  Lock,
  UserPlus,
  LogIn,
  Store,
  Plus,
  Minus,
} from "lucide-react";

interface AndroidInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  deferredPrompt: unknown;
  onTriggerNativeInstall: () => void;
}

export function AndroidInstallModal({
  isOpen,
  onClose,
  deferredPrompt,
  onTriggerNativeInstall,
}: AndroidInstallModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white text-[#111111] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-zinc-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#FF5A00] text-white flex items-center justify-center font-black text-lg">
              SE
            </div>
            <div>
              <h3 className="font-extrabold text-lg leading-tight">
                Installer SOUK EXPRESS
              </h3>
              <p className="text-xs text-zinc-500">
                Application PWA Android • Agadir (0 MAD)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-zinc-100 text-zinc-500"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {Boolean(deferredPrompt) && (
          <button
            onClick={onTriggerNativeInstall}
            className="w-full mb-4 py-3.5 px-4 rounded-xl bg-[#FF5A00] hover:bg-[#E04F00] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md transition"
          >
            <Smartphone className="w-4 h-4" />
            Installer directement sur cet appareil
          </button>
        )}

        <div className="bg-[#F8F7F4] rounded-xl p-4 border border-zinc-200 space-y-3 text-sm">
          <p className="font-bold text-[#111111]">
            Comment installer sur Android (Chrome / Samsung Internet) :
          </p>
          <ol className="space-y-2.5 text-zinc-700 list-decimal list-inside">
            <li>
              Ouvrez <strong>SOUK EXPRESS</strong> dans{" "}
              <strong>Google Chrome</strong> sur votre téléphone Android.
            </li>
            <li>
              Appuyez sur le menu <strong>⋮ (3 points)</strong> en haut à
              droite du navigateur.
            </li>
            <li>
              Sélectionnez{" "}
              <strong className="text-[#FF5A00]">
                « Installer l&apos;application »
              </strong>{" "}
              ou{" "}
              <strong className="text-[#FF5A00]">
                « Ajouter à l&apos;écran d&apos;accueil »
              </strong>
              .
            </li>
            <li>
              Validez : l&apos;icône orange et noire{" "}
              <strong>Souk Express</strong> apparaît sur votre écran d&apos;accueil
              en plein écran !
            </li>
          </ol>
        </div>

        <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-2.5 text-xs text-emerald-900">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <span>
            <strong>Sécurité & Confidentialité :</strong> Le mode hors-ligne
            met uniquement en cache l&apos;interface statique. Vos commandes et
            données personnelles ne sont jamais stockées dans un cache partagé.
          </span>
        </div>

        <button
          onClick={onClose}
          className="mt-5 w-full py-3 rounded-xl bg-[#111111] text-white font-bold text-sm hover:bg-zinc-800 transition"
        >
          Compris, merci !
        </button>
      </div>
    </div>
  );
}

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("+2126");
  const [signupRole, setSignupRole] = useState<"customer" | "partner">(
    "customer"
  );
  const [shopName, setShopName] = useState("");
  const [shopAddress, setShopAddress] = useState("Talborjt, Agadir");
  const [shopCategory, setShopCategory] = useState("restaurants");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "login"
            ? { action: "login", email, password }
            : {
                action: "signup",
                email,
                password,
                fullName,
                phone,
                role: signupRole,
                shopName,
                shopAddress,
                shopCategory,
              }
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erreur d'authentification");
      } else {
        onSuccess();
        onClose();
      }
    } catch {
      setError("Erreur réseau.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white text-[#111111] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-zinc-200 my-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#FF5A00] text-white flex items-center justify-center font-black">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg">
                {mode === "login"
                  ? "Connexion Souk Express"
                  : "Créer un compte à Agadir"}
              </h3>
              <p className="text-xs text-zinc-500">
                Connectez-vous avec votre compte Souk Express.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-zinc-100 text-zinc-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-100 rounded-xl mb-4">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError("");
            }}
            className={`py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition ${
              mode === "login"
                ? "bg-[#111111] text-white shadow-xs"
                : "text-zinc-600 hover:text-black"
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            Se connecter
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setError("");
            }}
            className={`py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition ${
              mode === "signup"
                ? "bg-[#FF5A00] text-white shadow-xs"
                : "text-zinc-600 hover:text-black"
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            Inscription
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === "signup" && (
            <>
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Type de compte
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSignupRole("customer")}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 ${
                      signupRole === "customer"
                        ? "border-[#FF5A00] bg-orange-50 text-[#FF5A00]"
                        : "border-zinc-200 text-zinc-600"
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Client Agadir
                  </button>
                  <button
                    type="button"
                    onClick={() => setSignupRole("partner")}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 ${
                      signupRole === "partner"
                        ? "border-[#FF5A00] bg-orange-50 text-[#FF5A00]"
                        : "border-zinc-200 text-zinc-600"
                    }`}
                  >
                    <Store className="w-3.5 h-3.5" />
                    Commerçant / Resto
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Nom complet
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="ex: Youssef Ait Baha"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm focus:outline-none focus:border-[#FF5A00]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Téléphone Maroc (+212)
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+212661234567"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm focus:outline-none focus:border-[#FF5A00]"
                />
              </div>

              {signupRole === "partner" && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-2.5">
                  <p className="text-[11px] font-bold text-amber-900">
                    Note : Les nouveaux commerces doivent être approuvés par
                    l&apos;administrateur avant d&apos;apparaître aux clients.
                  </p>
                  <input
                    type="text"
                    required
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                    placeholder="Nom du restaurant ou boutique à Agadir"
                    className="w-full px-3 py-2 rounded-lg border border-amber-300 bg-white text-xs"
                  />
                  <input
                    type="text"
                    required
                    value={shopAddress}
                    onChange={(e) => setShopAddress(e.target.value)}
                    placeholder="Adresse à Agadir (ex: Rue de Fès, Talborjt)"
                    className="w-full px-3 py-2 rounded-lg border border-amber-300 bg-white text-xs"
                  />
                  <select
                    value={shopCategory}
                    onChange={(e) => setShopCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-amber-300 bg-white text-xs font-semibold"
                  >
                    <option value="restaurants">Restaurants & Grillades</option>
                    <option value="souk">Souk El Had & Terroir</option>
                    <option value="patisserie">Boulangerie & Ftour</option>
                    <option value="epicerie">Primeur & Épicerie</option>
                  </select>
                </div>
              )}
            </>
          )}

          <div>
            <label className="block text-xs font-bold text-zinc-700 mb-1">
              Adresse Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="salma@client.ma ou admin@soukexpress.ma"
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm focus:outline-none focus:border-[#FF5A00]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-700 mb-1">
              Mot de passe
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm focus:outline-none focus:border-[#FF5A00]"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-[#FF5A00] hover:bg-[#E04F00] text-white font-bold text-sm transition shadow-md disabled:opacity-50"
          >
            {loading
              ? "Chargement..."
              : mode === "login"
                ? "Se connecter"
                : "Créer mon compte"}
          </button>
        </form>
      </div>
    </div>
  );
}

export interface ProductDetailItem {
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

interface ProductDetailModalProps {
  product: ProductDetailItem | null;
  shopName: string;
  lang: "fr" | "ar";
  onClose: () => void;
  onAddToCart: (product: ProductDetailItem, qty: number) => void;
}

export function ProductDetailModal({
  product,
  shopName,
  lang,
  onClose,
  onAddToCart,
}: ProductDetailModalProps) {
  const [qty, setQty] = useState(1);

  if (!product) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white text-[#111111] rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-zinc-200">
        <div className="relative h-56 bg-zinc-900">
          <img
            src={product.imageUrl}
            alt={lang === "ar" ? product.nameAr : product.nameFr}
            className="w-full h-full object-cover"
          />
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-black"
          >
            <X className="w-5 h-5" />
          </button>
          <span className="absolute bottom-3 left-3 px-3 py-1 rounded-full bg-[#111111]/90 text-white text-xs font-bold">
            {shopName}
          </span>
        </div>

        <div className="p-5">
          <div className="flex items-start justify-between gap-3 mb-2">
            <h3 className="font-extrabold text-lg leading-snug">
              {lang === "ar" ? product.nameAr : product.nameFr}
            </h3>
            <span className="px-3 py-1 rounded-xl bg-orange-50 text-[#FF5A00] font-black text-base shrink-0 font-mono">
              {product.priceMad} MAD
            </span>
          </div>

          <p className="text-xs text-zinc-600 leading-relaxed mb-5">
            {lang === "ar" ? product.descriptionAr : product.descriptionFr}
          </p>

          {product.isAvailable ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center border border-zinc-300 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setQty(Math.max(1, qty - 1))}
                  className="p-3 hover:bg-zinc-100 text-zinc-700"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="px-4 font-bold text-sm font-mono">{qty}</span>
                <button
                  type="button"
                  onClick={() => setQty(Math.min(20, qty + 1))}
                  className="p-3 hover:bg-zinc-100 text-zinc-700"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  onAddToCart(product, qty);
                  onClose();
                }}
                className="flex-1 py-3.5 px-4 rounded-xl bg-[#FF5A00] hover:bg-[#E04F00] text-white font-bold text-sm shadow-md transition flex items-center justify-between"
              >
                <span>
                  {lang === "ar" ? "إضافة إلى السلة" : "Ajouter au panier"}
                </span>
                <span className="font-mono font-black">
                  {product.priceMad * qty} MAD
                </span>
              </button>
            </div>
          ) : (
            <div className="py-3 px-4 rounded-xl bg-zinc-100 text-zinc-500 font-bold text-center text-sm">
              {lang === "ar"
                ? "غير متوفر حاليا"
                : "Produit momentanément épuisé"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
