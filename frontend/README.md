# Modulith Store frontend

The only application source is this React/Vite project. `src/main/resources/static` contains its compiled output, not a second CDN/Babel application.

## Run and verify

Use Node.js 22.12+ (22.x), 24.x, or 26+ and npm. From this directory:

```bash
npm ci
npm test
npm run dev
npm run build
```

Vite serves the development app on port 5173 and proxies `/api` to Spring Boot on port 8080. `npm run preview` serves the compiled Vite build for inspection. Start the backend using the repository's root instructions.

`npm run build` first creates `frontend/dist`, then publishes the compiled index and assets to `../src/main/resources/static`. The publisher preserves unrelated static files and removes only stale assets recorded in its `.frontend-manifest.json`. Rebuild before packaging Spring Boot after frontend changes. A compiled ES-module application must be served over HTTP; do not open its index via `file://`.

## Demo behavior

- Catalog metadata and stock come from `GET /api/products`. Filters and search work locally on that response.
- Cart checkout submits exactly one `POST /api/orders/checkout` request with `{items:[{productCode,quantity}],usePessimistic:true}`. Confirmation displays the returned order list. The cart is retained on failure; no partial checkout is simulated in the browser.
- The rush tool issues 5, 10, or 20 concurrent `POST /api/orders` requests with a selectable quantity and locking mode. These are real demo writes, not Java threads or a load benchmark. Browser connection limits may queue them. Results reflect actual responses; a lost response is not proof that a transaction rolled back.
- Restock calls `POST /api/inventory/restock-all`, then refreshes the catalog. This resets all demo inventory.
- Observability polls the selected page of `GET /api/orders?page=0&size=20` and `GET /api/notifications` while open. Previous/Next controls navigate bounded, newest-first order slices; pagination metadata comes from response headers. Offset pagination is a live view, so new purchases can shift older pages. Endpoint failures are shown explicitly rather than replaced with invented records.
- Notification delivery is simulated in the backend. No email or payment details are collected. The notification feed is bounded, in-memory, and reset by backend restart; it is not the durable event-publication registry.
- Without the backend, only sample catalog metadata is shown. Stock is unavailable and purchasing, rushes, and restocking are disabled. There is no fake database, locking, or outbox implementation.

The behavior tests use controlled HTTP responses to exercise UI paths, not to claim database consistency. Backend integration tests establish transaction semantics. The publisher test verifies preservation of unrelated Spring assets.
