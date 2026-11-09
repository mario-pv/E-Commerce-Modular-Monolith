import React, { useId, useState } from "react";

export const positiveInteger = (value) => Number.isSafeInteger(Number(value)) && Number(value) > 0;

export default function ProductActions({ product, connected, busy, inCart = 0, onAdd, onBuy, addLabel = "Add to Cart" }) {
  const [quantity, setQuantity] = useState("1");
  const id = useId();
  const available = Math.max(0, product.stock - inCart);
  const valid = positiveInteger(quantity);
  const unavailable = !connected || busy || product.stock <= 0;
  const error = !valid
    ? "Choose a positive whole number of units."
    : connected && Number(quantity) > available
      ? `Only ${available} more units available for your cart. Nothing added; choose a smaller quantity.`
      : null;
  return (
    <div className="mt-4">
      <label htmlFor={id} className="block text-[11px] text-slate-400 mb-1">Quantity <span className="sr-only">— Units to add for {product.name}</span></label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          aria-label={`Units to add for ${product.name}`}
          type="number" min="1" step="1" max={connected ? available : undefined}
          value={quantity} onChange={(event) => setQuantity(event.target.value)}
          disabled={unavailable} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}
          className="input-field !w-20 shrink-0 font-mono"
        />
        <button
          onClick={() => { if (!unavailable && !error) onAdd(product, Number(quantity)); }}
          disabled={unavailable || Boolean(error)}
          className="btn-secondary flex-1 justify-center"
        >{connected && product.stock <= 0 ? "Sold Out" : addLabel}</button>
        {onBuy && <button disabled={unavailable || !valid || Number(quantity) > product.stock}
          onClick={() => { if (!unavailable && valid && Number(quantity) <= product.stock) onBuy(product, Number(quantity)); }}
          className="btn-primary !px-3" title="Review this item before purchasing">Buy</button>}
      </div>
      {error && <p id={`${id}-error`} role="alert" className="text-xs text-amber-200 mt-2">{error}</p>}
    </div>
  );
}
