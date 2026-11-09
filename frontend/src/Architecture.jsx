import React from "react";
import { Database, Package, Bell } from "lucide-react";

export default function Architecture() {
  return (
    <>
      <p className="text-sm leading-relaxed text-slate-400 mb-6">
        One Spring Boot application, one database, three module boundaries.
      </p>
      <ol className="space-y-3">
        <li className="border border-emerald-500/25 bg-emerald-500/5 p-4 rounded-xl">
          <h3 className="text-sm text-emerald-300 font-semibold flex items-center gap-2">
            <Package size={16} />
            Order
          </h3>
          <p className="text-xs leading-relaxed text-slate-300 mt-2">
            Accepts a single order or an atomic cart. Persists one order per
            product and publishes OrderCreatedEvent inside the transaction.
          </p>
        </li>
        <li className="border border-cyan-500/25 bg-cyan-500/5 p-4 rounded-xl">
          <h3 className="text-sm text-cyan-300 font-semibold flex items-center gap-2">
            <Database size={16} />
            Inventory
          </h3>
          <p className="text-xs leading-relaxed text-slate-300 mt-2">
            Validates quantities and deducts stock. Cart checkout takes
            pessimistic row locks in a consistent product-code order. Any item
            failure rolls the whole cart back.
          </p>
        </li>
        <li className="border border-amber-500/25 bg-amber-500/5 p-4 rounded-xl">
          <h3 className="text-sm text-amber-300 font-semibold flex items-center gap-2">
            <Bell size={16} />
            Notification
          </h3>
          <p className="text-xs leading-relaxed text-slate-300 mt-2">
            An asynchronous module listener handles committed events in a
            separate transaction. Delivery is simulated; no SMTP service or real
            email is configured.
          </p>
        </li>
      </ol>
      <div className="rounded-xl bg-slate-800/60 p-4 mt-5">
        <p className="font-mono text-xs text-emerald-300">
          Request → Order → Inventory → Commit → Notification
        </p>
        <p className="text-xs text-slate-400 mt-3 leading-relaxed">
          Spring Modulith records event publications in the event_publication
          table. The notification feed is a separate, bounded in-memory view,
          not the durable publication registry.
        </p>
      </div>
      <p className="text-xs text-slate-500 mt-5">
        The rush tool launches concurrent HTTP requests from your browser, not
        Java threads or a production load test. Both pessimistic and optimistic
        modes use the real backend.
      </p>
    </>
  );
}
