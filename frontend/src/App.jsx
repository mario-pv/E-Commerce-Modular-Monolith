import React, { useCallback, useEffect, useRef, useState } from "react";
import { Bolt, ShoppingCart, RefreshCw } from "lucide-react";
import {
  INITIAL_PRODUCTS,
  fetchProducts,
  checkout,
  placeOrder,
  restockAll,
} from "./api/client";
import Modal from "./Modal";
import Catalog from "./Catalog";
import Cart from "./Cart";
import Observability from "./Observability";
import Architecture from "./Architecture";
import RushSimulator from "./RushSimulator";
import { positiveInteger } from "./ProductActions";

export default function App() {
  const [products, setProducts] = useState(INITIAL_PRODUCTS);
  const [connection, setConnection] = useState("loading");
  const [refreshing, setRefreshing] = useState(false);
  const [cart, setCart] = useState([]);
  const [buyCart, setBuyCart] = useState([]);
  const [modal, setModal] = useState(null);
  const [rushProduct, setRushProduct] = useState(null);
  const [view, setView] = useState("store");
  const [confirmation, setConfirmation] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [notice, setNotice] = useState(null);
  const mutation = useRef(false);
  const connected = connection === "online";

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      setProducts(await fetchProducts());
      setConnection("online");
    } catch {
      setConnection("offline");
    } finally {
      setRefreshing(false);
    }
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  const invalidItems = (items) => items.some(
    (item) =>
      !positiveInteger(item.quantity) || !products.some(
        (p) => p.id === item.productCode && p.stock >= item.quantity,
      ),
  );
  const invalidCart = invalidItems(cart);
  const add = (product, quantity) => {
    if (!connected || busy || !positiveInteger(quantity)) return;
    setCart((items) => {
      const existing = items.find((item) => item.productCode === product.id);
      const total = (existing?.quantity || 0) + quantity;
      if (!Number.isSafeInteger(total) || total > product.stock) return items;
      return existing
        ? items.map((item) =>
            item.productCode === product.id
              ? { ...item, quantity: total }
              : item,
          )
        : [...items, { productCode: product.id, quantity }];
    });
  };
  const closeModal = () => {
    if (!mutation.current) setModal(null);
  };
  const openRush = (product) => {
    if (!connected || mutation.current) return;
    setRushProduct(product?.id || products.find((item) => item.isFlashDeal)?.id || products[0]?.id);
    setModal("rush");
  };
  const openBuy = (product, quantity) => {
    if (!connected || mutation.current || !positiveInteger(quantity) || quantity > product.stock) return;
    setBuyCart([{ productCode: product.id, quantity }]);
    setMessage(null);
    setModal("buy");
  };
  const handleCheckout = async (source = "cart") => {
    const items = source === "buy" ? buyCart : cart;
    if (!connected || !items.length || invalidItems(items) || mutation.current) return;
    mutation.current = true;
    setBusy(true);
    setMessage(null);
    try {
      setConfirmation(await checkout(items));
      if (source === "buy") setBuyCart([]);
      else setCart([]);
      setModal("confirmation");
      await refresh();
    } catch (error) {
      setMessage(error.message);
      await refresh();
    } finally {
      mutation.current = false;
      setBusy(false);
    }
  };

  const handleRush = async (productCode, usePessimistic, requestCount, quantity) => {
    if (!connected || mutation.current || ![5, 10, 20].includes(requestCount)
      || !positiveInteger(quantity) || quantity > 100
      || typeof usePessimistic !== "boolean"
      || !products.some((product) => product.id === productCode && product.stock > 0)) return [];
    mutation.current = true;
    setBusy(true);
    try {
      const results = await Promise.allSettled(
        Array.from({ length: requestCount }, () =>
          placeOrder(productCode, quantity, usePessimistic),
        ),
      );
      await refresh();
      return results;
    } finally {
      mutation.current = false;
      setBusy(false);
    }
  };

  const handleRestock = async () => {
    if (!connected || mutation.current) return;
    mutation.current = true;
    setBusy(true);
    setNotice(null);
    try {
      await restockAll();
      await refresh();
      setNotice({ text: "Inventory reset confirmed by backend." });
    } catch (error) {
      setNotice({ text: error.message, error: true });
      await refresh();
    } finally {
      mutation.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-dark-900 text-slate-100">
      <div className="border-b border-emerald-500/20 bg-emerald-950/30 px-4 py-2 text-center text-xs text-slate-300">
        <span className="text-emerald-400 font-semibold">DEMO</span> ·
        Spring Modulith · Real inventory transactions · Simulated notifications
      </div>
      <header className="border-b border-slate-800 bg-dark-900/95 sticky top-0 z-30 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500/15 border border-emerald-500/40 p-2.5 rounded-xl">
              <Bolt className="text-emerald-400" size={22} />
            </div>
            <div>
              <span className="font-extrabold tracking-wide">
                MODULITH <span className="text-emerald-400">STORE</span>
              </span>
              <p className="text-xs text-slate-400">
                High-concurrency commerce
              </p>
            </div>
          </div>
          <nav
            aria-label="Main navigation"
            className="flex gap-2 items-center flex-wrap"
          >
            <button
              onClick={() => setView("store")}
              aria-pressed={view === "store"}
              className="btn-secondary"
            >
              Storefront
            </button>
            <button
              onClick={() => setView("observability")}
              aria-pressed={view === "observability"}
              className="btn-secondary"
            >
              Observability
            </button>
            <button
              onClick={() => setModal("architecture")}
              className="btn-secondary"
            >
              Architecture
            </button>
            <button
              onClick={() => openRush()}
              disabled={!connected || busy}
              className="btn-secondary text-amber-200"
            >
              Flash Rush Simulator
            </button>
            <button
              onClick={refresh}
              disabled={refreshing || busy}
              className={`btn-secondary text-xs ${connected ? "text-emerald-300" : "text-amber-300"}`}
            >
              <RefreshCw
                size={13}
                className={refreshing ? "animate-spin" : ""}
              />
              {connection === "loading"
                ? "Connecting…"
                : connected
                  ? "Backend online"
                  : "Retry connection"}
            </button>
            <button
              onClick={() => {
                setMessage(null);
                setModal("cart");
              }}
              className="btn-primary"
            >
              <ShoppingCart size={16} />
              Cart ({count})
            </button>
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-7">
        <div className="flex justify-end mb-4">
          <button
            onClick={handleRestock}
            disabled={!connected || busy}
            className="text-xs text-slate-400 underline decoration-dotted"
          >
            Restock demo inventory
          </button>
        </div>
        {notice && (
          <p
            role={notice.error ? "alert" : "status"}
            className={`text-sm rounded-xl border border-slate-700 p-4 mb-5 ${notice.error ? "text-amber-200" : "text-emerald-300"}`}
          >
            {notice.text}
          </p>
        )}
        {!connected && (
          <p
            role="status"
            className="rounded-xl border border-amber-500/30 bg-amber-500/5 text-amber-200 text-sm p-4 mb-6"
          >
            {connection === "loading"
              ? "Connecting to the backend…"
              : "Backend offline — catalog preview only. Stock is unavailable; purchasing and the rush simulator are disabled."}
          </p>
        )}
        {view === "store" ? (
          <Catalog
            products={products}
            connected={connected}
            busy={busy}
            onAdd={add}
            onBuy={openBuy}
            cart={cart}
            onRush={openRush}
            onArchitecture={() => setModal("architecture")}
          />
        ) : (
          <Observability connected={connected} />
        )}
      </main>
      <footer className="max-w-7xl w-full mx-auto px-4 lg:px-8 py-6 text-xs text-slate-500 border-t border-slate-800">
        Built to demonstrate module boundaries, stock consistency, and
        asynchronous events. Sample products; no payment is collected.
      </footer>
      {modal === "architecture" && (
        <Modal title="Architecture" onClose={closeModal}>
          <Architecture />
        </Modal>
      )}
      {modal === "rush" && (
        <Modal title="Flash Rush Simulator" onClose={closeModal} busy={busy}>
          <RushSimulator
            products={products}
            connected={connected}
            busy={busy}
            onRun={handleRush}
            initialProductCode={rushProduct}
          />
        </Modal>
      )}
      {(modal === "cart" || modal === "buy") && (
        <Modal title={modal === "buy" ? "Review purchase" : "Your cart"} onClose={closeModal} busy={busy}>
          {modal === "buy" && <p className="text-sm text-emerald-300 mb-4">Your existing cart is not included and will stay unchanged. Confirm only this purchase below.</p>}
          <Cart
            cart={modal === "buy" ? buyCart : cart}
            setCart={modal === "buy" ? setBuyCart : setCart}
            products={products}
            connected={connected}
            busy={busy}
            invalid={modal === "buy" ? invalidItems(buyCart) : invalidCart}
            onCheckout={() => handleCheckout(modal === "buy" ? "buy" : "cart")}
          />
          {message && (
            <p role="alert" className="text-red-300 text-sm mt-4">
              {message}
            </p>
          )}
        </Modal>
      )}
      {modal === "confirmation" && (
        <Modal title="Order confirmed" onClose={closeModal} busy={busy}>
          <p className="text-sm text-emerald-300 mb-5">
            The backend accepted your purchase.
          </p>
          <ul className="space-y-3">
            {confirmation.map((order) => (
              <li
                key={order.orderNumber}
                className="rounded-xl bg-slate-800/60 p-4"
              >
                <p className="font-mono text-sm text-emerald-300 break-all">
                  {order.orderNumber}
                </p>
                <p className="text-sm text-slate-300 mt-2">
                  {order.productCode} × {order.quantity} · {order.status}
                </p>
              </li>
            ))}
          </ul>
          <p className="text-xs text-slate-400 my-5">
            Notifications are simulated by the backend listener. No email was
            sent.
          </p>
          <button onClick={closeModal} disabled={busy} className="btn-primary">
            Continue shopping
          </button>
        </Modal>
      )}
    </div>
  );
}
