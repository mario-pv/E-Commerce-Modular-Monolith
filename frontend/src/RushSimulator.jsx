import React, { useState } from "react";
import { Flame } from "lucide-react";
import { positiveInteger } from "./ProductActions";

export default function RushSimulator({ products, connected, busy, onRun, initialProductCode }) {
  const [productCode, setProductCode] = useState(
    initialProductCode || products.find((p) => p.isFlashDeal)?.id || products[0]?.id || "",
  );
  const [pessimistic, setPessimistic] = useState(true);
  const [requestCount, setRequestCount] = useState(10);
  const [quantity, setQuantity] = useState("1");
  const validQuantity = positiveInteger(quantity) && Number(quantity) <= 100;
  const [results, setResults] = useState(null);
  const product = products.find((p) => p.id === productCode);
  const run = async () => {
    if (!connected || busy || !validQuantity || !product || product.stock <= 0) return;
    setResults(null);
    setResults(await onRun(productCode, pessimistic, requestCount, Number(quantity)));
  };
  const accepted =
    results?.filter((result) => result.status === "fulfilled").length || 0;
  return (
    <>
      <p className="text-sm text-slate-400 leading-relaxed mb-5">
        Launch concurrent HTTP requests with your chosen units against the real
        single-order endpoint. This changes database stock and creates real demo
        orders. Browser connection limits may queue requests; this is not a
        benchmark or a Java-thread test.
      </p>
      <label
        className="block text-xs text-slate-300 mb-2"
        htmlFor="rush-product"
      >
        Target product
      </label>
      <select
        id="rush-product"
        className="input-field mb-3"
        value={productCode}
        onChange={(e) => setProductCode(e.target.value)}
        disabled={busy || !connected}
      >
        {products.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <p className="text-xs text-slate-400 mb-5">
        Latest stock snapshot:{" "}
        <span className="text-emerald-300 font-mono">
          {connected ? (product?.stock ?? "Unavailable") : "Unavailable"}
        </span>
      </p>
      <div className="grid sm:grid-cols-2 gap-4 mb-4">
        <fieldset disabled={busy || !connected}>
          <legend className="text-xs text-slate-400 mb-2">Request count</legend>
          <div className="flex gap-1 rounded-xl bg-dark-850 border border-slate-700 p-1">
            {[5, 10, 20].map((count) => (
              <label key={count} className={`relative flex-1 text-center rounded-lg p-2 text-xs font-mono cursor-pointer ${count === requestCount ? "bg-emerald-500 text-black" : "text-slate-300"}`}>
                <input className="sr-only peer" type="radio" name="request-count" checked={requestCount === count}
                  onChange={() => setRequestCount(count)} aria-label={`${count} requests`} />
                <span className="peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4">{count}x</span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset disabled={busy || !connected}>
          <legend className="text-xs text-slate-400 mb-2">Locking strategy</legend>
          <div className="flex gap-1 rounded-xl bg-dark-850 border border-slate-700 p-1">
            {[{ name: "Pessimistic", value: true }, { name: "Optimistic", value: false }].map((mode) => (
              <label key={mode.name} className={`relative flex-1 text-center rounded-lg p-2 text-xs cursor-pointer ${pessimistic === mode.value ? (mode.value ? "bg-emerald-500 text-black" : "bg-amber-400 text-black") : "text-slate-300"}`}>
                <input className="sr-only peer" type="radio" name="locking-strategy" checked={pessimistic === mode.value}
                  onChange={() => setPessimistic(mode.value)} />
                <span className="peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4">{mode.name}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      <p className="text-xs text-slate-500 mb-5">
        {pessimistic
          ? "SELECT FOR UPDATE serializes competing stock updates."
          : "Optimistic mode uses @Version; competing updates may fail with a conflict. No automatic client retries."}
      </p>
      <label htmlFor="rush-quantity" className="block text-xs text-slate-300 mb-2">Units per request</label>
      <input id="rush-quantity" type="number" min="1" max="100" step="1" value={quantity}
        onChange={(event) => setQuantity(event.target.value)} disabled={busy || !connected}
        aria-invalid={!validQuantity} aria-describedby="rush-quantity-help" className="input-field" />
      <p id="rush-quantity-help" className={`text-xs mt-2 ${validQuantity ? "text-slate-400" : "text-amber-200"}`}>
        Choose a positive whole number from 1 to 100.
      </p>
      <p className="text-sm font-mono text-cyan-300 my-4" aria-live="polite">
        Estimated total requested units: {validQuantity ? requestCount * Number(quantity) : "—"}
      </p>
      <button
        disabled={!connected || busy || !product || product.stock <= 0 || !validQuantity}
        onClick={run}
        className="btn-primary w-full justify-center bg-gradient-to-r from-emerald-500 to-cyan-500"
      >
        <Flame size={15} />
        {busy ? "Running…" : `Launch ${requestCount} requests`}
      </button>
      {results && (
        <div className="mt-6">
          <p
            role="status"
            className="text-sm text-emerald-300 font-semibold mb-3"
          >
            {accepted} accepted · {results.length - accepted} not confirmed
          </p>
          <p className="text-xs text-slate-500 mb-4">
            Unconfirmed requests include rejected transactions and transport
            failures. Check order history before retrying; a lost response does
            not prove rollback.
          </p>
          <ol className="space-y-2 max-h-64 overflow-y-auto">
            {results.map((result, i) => (
              <li
                key={i}
                className="text-xs p-3 rounded-lg bg-slate-800/60 flex gap-3"
              >
                <span className="font-mono text-slate-500">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  className={
                    result.status === "fulfilled"
                      ? "text-emerald-300 font-mono break-all"
                      : "text-amber-200"
                  }
                >
                  {result.status === "fulfilled"
                    ? result.value.orderNumber
                    : result.reason.message}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
      {!connected && (
        <p className="text-amber-300 text-sm mt-4">
          Backend unavailable. The simulator is disabled.
        </p>
      )}
    </>
  );
}
