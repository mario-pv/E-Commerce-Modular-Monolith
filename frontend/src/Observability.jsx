import React, { useCallback, useEffect, useRef, useState } from "react";
import { Activity, RefreshCw } from "lucide-react";
import { fetchOrders, fetchNotifications } from "./api/client";

const notificationLabel = (status) =>
  ({
    RECEIVED_FROM_OUTBOX: "Event received from outbox",
    SIMULATED_DELIVERY: "Simulated delivery completed",
    SIMULATED_DELIVERY_SUCCESS: "Simulated delivery completed",
    DISPATCHED_SMTP_SUCCESS: "Simulated delivery completed (legacy status)",
  })[status] || `Simulated notification · ${status}`;
const time = (timestamp) =>
  timestamp ? new Date(timestamp).toLocaleTimeString() : "Time unavailable";

export default function Observability({ connected }) {
  const [page, setPage] = useState(0);
  const [history, setHistory] = useState(null);
  const orders = history?.page === page ? history.orders : null;
  const [notifications, setNotifications] = useState(null);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [updated, setUpdated] = useState(null);
  const running = useRef(null);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const currentGeneration = generation.current;
    if (!connected || running.current === currentGeneration) return;
    running.current = currentGeneration;
    setLoading(true);
    const [historyResult, feed] = await Promise.allSettled([
      fetchOrders(page),
      fetchNotifications(),
    ]);
    if (generation.current === currentGeneration) {
      if (historyResult.status === "fulfilled") setHistory(historyResult.value);
      if (feed.status === "fulfilled") setNotifications(feed.value);
      setErrors({
        orders: historyResult.status === "rejected",
        feed: feed.status === "rejected",
      });
      setUpdated(new Date().toLocaleTimeString());
      setLoading(false);
    }
    if (running.current === currentGeneration) running.current = null;
  }, [connected, page]);
  useEffect(() => {
    generation.current++;
    setErrors((current) => ({ ...current, orders: false }));
    if (!connected) setLoading(false);
    refresh();
    const timer = setInterval(refresh, 2000);
    return () => {
      // Navigation, disconnects and unmount invalidate every old response,
      // without letting an old request clear a newer request's running guard.
      generation.current++;
      clearInterval(timer);
    };
  }, [refresh, connected]);
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <p className="text-xs font-mono text-cyan-300 mb-2 flex items-center gap-2">
            <Activity size={14} />
            MODULE ACTIVITY
          </p>
          <h1 className="text-2xl font-bold">Observability</h1>
          <p className="text-xs text-slate-400 mt-2">
            API snapshots, not infrastructure metrics. Refreshes every 2 seconds
            while this view is open.
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={!connected || loading}
          className="btn-secondary"
        >
          <RefreshCw size={14} />
          Refresh activity
        </button>
      </div>
      <p className="text-xs text-slate-500 mb-5">
        {!connected
          ? "Backend unavailable. Activity cannot be loaded."
          : updated
            ? `Last refresh attempt: ${updated}`
            : "Loading activity…"}
      </p>
      <div className="grid lg:grid-cols-2 gap-6">
        <section
          aria-label="Order history"
          className="glass-card rounded-2xl p-5 min-w-0"
        >
          <h2 className="font-semibold mb-2">Order history</h2>
          <p className="text-xs text-slate-400 mb-5">
            Persisted orders, newest first. Next shows older orders; Previous
            shows newer orders. New orders can shift page boundaries on refresh.
          </p>
          <nav
            aria-label="Order history pages"
            className="flex items-center justify-between gap-3 mb-4"
          >
            <button
              className="btn-secondary"
              disabled={!connected || page === 0}
              onClick={() => setPage((current) => current - 1)}
            >
              Previous
            </button>
            <span aria-live="polite" className="text-xs text-slate-400">
              Page {page + 1}
            </span>
            <button
              className="btn-secondary"
              disabled={!connected || loading || history?.page !== page || !history.hasMore}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </button>
          </nav>
          {loading && (
            <p role="status" className="text-sm text-slate-400 mb-4">
              Loading order history…
            </p>
          )}
          {errors.orders && (
            <p role="alert" className="text-sm text-amber-300 mb-4">
              Order history unavailable. Any displayed records are from the last
              successful refresh.
            </p>
          )}
          {orders?.length ? (
            <div className="space-y-3 max-h-[32rem] overflow-y-auto">
              {orders.map((order) => (
                <article
                  key={order.id || order.orderNumber}
                  className="border border-slate-700/60 rounded-xl p-3"
                >
                  <p className="font-mono text-xs text-emerald-300 break-all">
                    {order.orderNumber}
                  </p>
                  <p className="text-xs text-slate-300 mt-2">
                    {order.productCode} × {order.quantity}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-2">
                    {order.status}
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              {orders
                ? page === 0 ? "No orders yet." : "No orders on this page."
                : "No order snapshot available."}
            </p>
          )}
        </section>
        <section
          aria-label="Notification feed"
          className="glass-card rounded-2xl p-5 min-w-0"
        >
          <h2 className="font-semibold mb-2">Notification feed</h2>
          <p className="text-xs text-amber-200/90 mb-5">
            Simulated notifications only. No email is sent. This in-memory feed
            is bounded and resets when the backend restarts; it is not a durable
            delivery audit.
          </p>
          {errors.feed && (
            <p role="alert" className="text-sm text-amber-300 mb-4">
              Notification feed unavailable. Any displayed events are from the
              last successful refresh.
            </p>
          )}
          {notifications?.length ? (
            <div className="space-y-3 max-h-[32rem] overflow-y-auto">
              {notifications.map((event, index) => (
                <article
                  key={`${event.orderNumber}-${event.status}-${event.timestamp}-${index}`}
                  className="border-l-2 border-cyan-500/50 bg-slate-800/40 rounded-r-xl p-3"
                >
                  <p className="text-xs font-semibold text-cyan-300">
                    {notificationLabel(event.status)}
                  </p>
                  <p className="font-mono text-xs text-slate-200 break-all mt-2">
                    {event.orderNumber}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {event.productCode} × {event.quantity}
                  </p>
                  <div className="flex flex-wrap justify-between gap-2 mt-3 font-mono text-[10px] text-slate-500">
                    <span>{time(event.timestamp)}</span>
                    <span>{event.processingTimeMs ?? 0} ms</span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              {notifications
                ? "No notification events yet. Delivery simulation runs asynchronously after checkout."
                : "No notification snapshot available."}
            </p>
          )}
        </section>
      </div>
    </>
  );
}
