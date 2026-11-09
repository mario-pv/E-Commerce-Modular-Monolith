import React from "react";
import { Cpu, Flame, Rocket, ShieldCheck } from "lucide-react";
import ProductPrice from "./ProductPrice";
import ProductActions from "./ProductActions";

export default function StoreHero({ products, connected, busy, cart, onAdd, onRush, onArchitecture }) {
  const featured = products.find((product) => product.id === "FLASH_ITEM") || products.find((product) => product.isFlashDeal);
  return (
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-dark-850 via-slate-900 to-dark-800 border border-slate-800 p-6 sm:p-8 mb-8">
      <div aria-hidden="true" className="absolute top-0 right-0 -mt-12 -mr-12 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div aria-hidden="true" className="absolute bottom-0 left-1/3 -mb-12 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="relative flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div className="max-w-2xl min-w-0">
          <p className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-mono mb-3">
            <Flame size={14} aria-hidden="true" /> FLASH SALE // REAL TRANSACTIONS, DEMO PRODUCTS
          </p>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white mb-3">Explore Concurrency in Real-Time.</h1>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed mb-4">
            Experience a storefront built on Spring Boot and Spring Modulith.
            Compare optimistic and pessimistic locking against real inventory,
            then follow order events across module boundaries. No payment is collected.
          </p>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => onRush(featured)} disabled={!connected || busy || !featured || featured.stock <= 0} className="btn-primary shadow-md shadow-emerald-500/20">
              <Rocket size={15} aria-hidden="true" /> Configure Flash Rush
            </button>
            <button onClick={onArchitecture} disabled={busy} className="btn-secondary">
              <ShieldCheck size={15} aria-hidden="true" /> View Bounded Contexts
            </button>
          </div>
        </div>
        {featured && <section aria-label="Featured flash sale" className="w-full lg:w-80 shrink-0 glass-card p-4 rounded-xl !border-emerald-500/30 glow-emerald">
          <div className="flex items-center justify-between gap-2 text-xs mb-2">
            <span className="font-mono text-emerald-400">#{featured.id}</span>
            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold">FLASH DEAL</span>
          </div>
          <div className="relative h-32 rounded-lg overflow-hidden mb-3 bg-slate-900 flex items-center justify-center">
            <Cpu className="absolute text-slate-600" size={48} aria-hidden="true" />
            {featured.image && <img src={featured.image} alt="" className="relative w-full h-full object-cover" onError={(event) => { event.currentTarget.style.visibility = "hidden"; }} />}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent flex items-end p-2">
              <p className="text-xs font-bold text-white">{featured.name}</p>
            </div>
          </div>
          <ProductPrice product={featured} />
          <p className="font-mono text-xs text-emerald-300 mt-2">
            {connected ? (featured.stock > 0 ? `${featured.stock} in stock` : "Sold out") : "Stock unavailable"}
          </p>
          <ProductActions product={featured} connected={connected} busy={busy} onAdd={onAdd}
            inCart={cart.find((item) => item.productCode === featured.id)?.quantity || 0} addLabel="Quick Add to Cart" />
        </section>}
      </div>
    </section>
  );
}
