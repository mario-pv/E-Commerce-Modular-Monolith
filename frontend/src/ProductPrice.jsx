import React from "react";

export const money = (value) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

export default function ProductPrice({ product }) {
  const discounted = Number.isFinite(product.originalPrice) && product.originalPrice > product.price;
  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-mono text-lg font-extrabold text-white">{money(product.price)}</span>
        {discounted && <del className="text-xs text-slate-400 font-mono">{money(product.originalPrice)}</del>}
      </div>
      {discounted && <p className="text-[11px] text-emerald-300 mt-1">
        Save {money(product.originalPrice - product.price)} ({Math.round((1 - product.price / product.originalPrice) * 100)}%)
      </p>}
    </div>
  );
}
