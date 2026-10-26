import Link from "next/link";

export default function OfflinePage() {
  return (
    <main className="min-h-screen bg-[#111111] text-white flex flex-col items-center justify-center p-6 text-center">
      <div className="w-20 h-20 rounded-2xl bg-[#FF5A00] flex items-center justify-center font-black text-3xl mb-6 shadow-lg">
        SE
      </div>
      <h1 className="text-2xl font-extrabold mb-2">
        Connexion Internet interrompue
      </h1>
      <p className="text-lg font-bold text-[#FF5A00] mb-3" dir="rtl">
        انقطع الاتصال بالإنترنت في أكادير
      </p>
      <p className="text-sm text-zinc-300 max-w-md mb-6 leading-relaxed">
        Vous êtes actuellement hors ligne. Pour protéger vos données privées et
        l&apos;état réel de vos commandes à Agadir, Souk Express ne stocke
        aucune commande sensible dans le cache partagé.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
        <Link
          href="/"
          className="w-full py-3.5 px-5 rounded-xl bg-[#FF5A00] text-white font-bold text-sm hover:bg-[#E04F00] transition text-center"
        >
          Réessayer / إعادة المحاولة
        </Link>
        <a
          href="https://wa.me/212661102030?text=Salam%20Souk%20Express%20Agadir"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-3.5 px-5 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 transition text-center"
        >
          Support WhatsApp
        </a>
      </div>
    </main>
  );
}
