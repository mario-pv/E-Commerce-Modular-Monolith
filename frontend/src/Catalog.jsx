import React, { useState } from "react";
import { Cpu, Flame } from "lucide-react";
import ProductActions from "./ProductActions";
import ProductPrice from "./ProductPrice";
import StoreHero from "./StoreHero";

export { money } from "./ProductPrice";

export default function Catalog({ products, connected, busy, onAdd, cart, onRush, onArchitecture, onBuy }) {
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const categories = [
    "All",
    "Flash Deals",
    ...new Set(products.map((p) => p.category)),
  ];
  const filtered = products.filter(
    (p) =>
      (category === "All" ||
        (category === "Flash Deals"
          ? p.isFlashDeal
          : p.category === category)) &&
      `${p.name} ${p.description} ${p.category}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <>
      <StoreHero products={products} connected={connected} busy={busy} cart={cart} onAdd={onAdd} onRush={onRush} onArchitecture={onArchitecture} />
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <div
          role="group"
          aria-label="Product categories"
          className="flex gap-2 flex-wrap"
        >
          {categories.map((item) => (
            <button
              key={item}
              aria-pressed={category === item}
              onClick={() => setCategory(item)}
              className={`px-3 py-2 text-xs rounded-lg border ${category === item ? "bg-slate-200 text-black border-slate-200 font-semibold" : "bg-dark-850 border-slate-800 text-slate-400 hover:text-white"}`}
            >
              {item}
            </button>
          ))}
        </div>
        <input
          aria-label="Search products"
          placeholder="Search hardware, specs…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field sm:w-64"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((product) => (
          <article
            key={product.id}
            aria-label={product.name}
            className="glass-card glass-card-hover rounded-2xl overflow-hidden flex flex-col"
          >
            <div className="relative h-44 bg-slate-900 flex items-center justify-center">
              <Cpu className="absolute text-slate-700" size={64} />
              {product.image && (
                <img
                  src={product.image}
                  alt=""
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.style.visibility = "hidden";
                  }}
                  className="relative w-full h-full object-cover"
                />
              )}
              <span className="absolute top-3 left-3 text-[10px] bg-black/75 rounded-full px-2.5 py-1 border border-white/10">
                {product.category}
              </span>
              {product.isFlashDeal && (
                <span className="absolute top-3 right-3 text-[10px] bg-emerald-400 text-black font-bold rounded-full px-2.5 py-1">
                  FLASH DEAL
                </span>
              )}
            </div>
            <div className="p-5 flex flex-col flex-1">
              <h2 className="font-semibold text-sm leading-relaxed">
                {product.name}
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed mt-2 mb-4">
                {product.description}
              </p>
              <div className="flex gap-1.5 flex-wrap mb-5">
                {(product.specs || []).slice(0, 3).map((spec) => (
                  <span
                    key={spec}
                    className="text-[10px] bg-slate-800 rounded px-2 py-1 text-slate-300"
                  >
                    {spec}
                  </span>
                ))}
              </div>
              <div className="mt-auto border-t border-slate-800 pt-4 flex items-center justify-between gap-2">
                <ProductPrice product={product} />
                <span
                  className={`text-xs font-mono ${connected && product.stock <= 0 ? "text-red-300" : "text-emerald-300"}`}
                >
                  {connected
                    ? product.stock <= 0
                      ? "Sold out"
                      : `${product.stock} in stock`
                    : "Stock unavailable"}
                </span>
              </div>
              <ProductActions product={product} connected={connected} busy={busy} onAdd={onAdd} onBuy={onBuy}
                inCart={cart.find((item) => item.productCode === product.id)?.quantity || 0} />
              <button onClick={() => onRush(product)} disabled={!connected || busy || product.stock <= 0}
                className="w-full text-[10px] text-slate-400 hover:text-emerald-400 font-mono py-2 mt-1 hover:underline flex items-center justify-center gap-1">
                <Flame size={12} aria-hidden="true" /> Simulate Concurrency Rush on this SKU
              </button>
            </div>
          </article>
        ))}
      </div>
      {!filtered.length && (
        <p className="text-slate-400 text-sm py-12 text-center">
          No products match your search.
        </p>
      )}
    </>
  );
}
