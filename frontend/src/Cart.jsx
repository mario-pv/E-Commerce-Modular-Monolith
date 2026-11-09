import React from "react";
import { money } from "./Catalog";

export default function Cart({
  cart,
  setCart,
  products,
  connected,
  busy,
  invalid,
  onCheckout,
}) {
  const lines = cart.map((item) => ({
    ...item,
    product: products.find((p) => p.id === item.productCode),
  }));
  const total = lines.reduce(
    (sum, item) => sum + (item.product?.price || 0) * item.quantity,
    0,
  );
  const changeQuantity = (code, delta) =>
    setCart((items) =>
      items
        .map((item) =>
          item.productCode === code
            ? { ...item, quantity: item.quantity + delta }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  return (
    <>
      {!cart.length ? (
        <p className="text-slate-400 py-6">
          Your cart is empty. Add something from the catalog.
        </p>
      ) : (
        <>
          <ul className="space-y-4">
            {lines.map((item) => {
              const product = item.product;
              const name = product?.name || item.productCode;
              return (
                <li
                  key={item.productCode}
                  className="border-b border-slate-800 pb-4"
                >
                  <p className="text-sm font-semibold">{name}</p>
                  <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
                    <div className="flex items-center gap-3">
                      <button
                        aria-label={`Decrease ${name}`}
                        disabled={busy}
                        onClick={() => changeQuantity(item.productCode, -1)}
                        className="btn-secondary"
                      >
                        −
                      </button>
                      <span
                        aria-label={`Quantity ${name}`}
                        className="font-mono"
                      >
                        {item.quantity}
                      </span>
                      <button
                        aria-label={`Increase ${name}`}
                        disabled={
                          busy ||
                          !connected ||
                          !product ||
                          item.quantity >= product.stock
                        }
                        onClick={() => changeQuantity(item.productCode, 1)}
                        className="btn-secondary"
                      >
                        +
                      </button>
                    </div>
                    <span className="text-sm font-mono">
                      {money((product?.price || 0) * item.quantity)}
                    </span>
                    <button
                      disabled={busy}
                      onClick={() =>
                        setCart((items) =>
                          items.filter(
                            (i) => i.productCode !== item.productCode,
                          ),
                        )
                      }
                      className="text-xs text-slate-400 underline"
                    >
                      Remove <span className="sr-only">{name}</span>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="flex justify-between font-bold mt-5">
            <span>Total</span>
            <span className="font-mono">{money(total)}</span>
          </div>
          <p className="text-xs text-slate-400 mt-4 mb-5">
            All items commit together or none do. Pessimistic locking is always
            enabled for checkout. No payment or email is collected.
          </p>
          {invalid && (
            <p role="alert" className="text-amber-300 text-sm mb-4">
              Stock changed. Reduce or remove unavailable items before checkout.
            </p>
          )}
          <button
            onClick={onCheckout}
            disabled={busy || !connected || invalid}
            className="btn-primary w-full justify-center"
          >
            {busy ? "Submitting…" : "Confirm checkout"}
          </button>
        </>
      )}
      {!connected && (
        <p className="text-amber-300 text-sm mt-4">
          Backend unavailable. Checkout is disabled.
        </p>
      )}
    </>
  );
}
