# Architecture

## One application, three modules

This is a Java 21 / Spring Boot application, not a set of microservices. Spring Modulith discovers modules from the packages beneath `com.portfolio.modulith`:

- `order`: accepts purchases, coordinates transactions, stores orders, and publishes `OrderCreatedEvent`.
- `inventory`: owns stock quantities, the demo product catalog, and stock locking.
- `notification`: consumes order events after commit and records simulated notification activity.

The modules share one MySQL database. `OrderService` calls `InventoryService` directly for an immediate stock decision. Notifications use an event so they do not need to run inside the purchase transaction. Inventory persistence types live in `inventory.internal`; callers receive immutable `StockView` records, not managed JPA entities.

## Following a purchase

```text
React storefront
  -> OrderController
     -> OrderService (@Transactional)
        -> InventoryService: deduct stock
        -> OrderRepository: save orders
        -> publish OrderCreatedEvent for each order
     -> commit stock, orders, and event publications together
  <- confirmed orders

After commit:
  -> NotificationListener (@ApplicationModuleListener)
     -> simulate slow notification work
     -> update the in-memory activity feed
```

Cart checkout uses one transaction for all items. If an item cannot be purchased, earlier stock deductions and orders from that checkout roll back too. Each item is still represented by a separate `Order` row; this demo does not introduce a separate cart/order-lines schema. The standalone purchase endpoint remains available for the concurrency simulator.

## Database model

- `inventory_stock`: generated numeric `id`, unique `productCode`, `quantity`, and optimistic-lock `version`.
- `order_orders`: generated numeric `id`, unique `orderNumber`, `productCode`, `quantity`, and `status` (currently `CREATED`).
- Spring Modulith also manages its event publication records. These are separate from the notification feed shown in the browser.

Flyway owns the physical schema through `src/main/resources/db/migration`; Hibernate uses `ddl-auto: validate`. V1 captures the original schema; V2 adds Modulith 2.1's publication lifecycle fields and preserves/backfills legacy events. Adoption of an existing pre-Flyway database requires the explicit, one-time `local-db-upgrade` profile. See [database migrations](docs/database-migrations.md); default startup never silently baselines an unknown non-empty schema.

Names above describe Java fields; Hibernate supplies physical column naming. Product names, prices, images, and specifications are demo catalog data, not a persisted catalog or payment ledger.

## Concurrency

Pessimistic locking is the default: a stock lookup uses a database write lock and competing transactions wait for that row. Timeouts or deadlocks can still fail a request. Multi-product checkouts process product codes in a consistent order to reduce deadlock risk.

Optimistic mode uses `Stock.version` to reject conflicting writes. The application reports a conflict rather than silently retrying a purchase. The browser's rush simulator issues concurrent HTTP requests; the MySQL integration tests exercise actual database transactions.

Seeding and restocking are separate. Startup seeding creates missing demo stock without changing existing quantities. The demo restock action resets known products to their initial quantities. It does not erase orders or event history.

## Events and delivery limits

`@ApplicationModuleListener` runs asynchronously after the purchase commits, in a separate transaction. The JPA event publication registry records outstanding listener work. It does not by itself promise exactly-once external delivery or unlimited automatic retries. This demo has no automatic retry worker.

The notification handler simulates delivery. It does not contact an email provider. Its recent activity feed is bounded, held in memory, and lost on restart. A real sender would need credentials, failure handling, replay policy, and idempotency before making production delivery guarantees.

## Frontend and build

`frontend/src` is the source of the React/Vite application. `npm run build` builds into `frontend/dist` and publishes the compiled files to `src/main/resources/static`, where Spring Boot serves them. The publisher tracks its generated files and preserves unrelated static assets. The former separate CDN/Babel storefront is no longer a second implementation.

In development, Vite proxies `/api` to Spring Boot on port 8080. With the backend unavailable, the UI permits catalog preview but disables purchases, restocking, and the rush simulator.

## Running and stopping the demo

`compose.yaml` groups `modulith-app` and `modulith-mysql` under `e-commerce-modular-monolith` in Docker Desktop. The Dockerfile builds the frontend and backend from source and runs the JAR on Java 21 as a non-root user. The app waits for a MySQL healthcheck before starting; its own healthcheck reads the inventory API.

Use the Compose project/group Start/Stop controls, or `docker compose start --wait` / `docker compose stop`, for the whole stack. Stopping only the MySQL service does not terminate a JVM. The app has its own visible container and can be stopped independently. Neither service has an automatic restart policy.

Ports 8080 and 3306 are published on localhost only. MySQL uses the named `modulith-mysql-data` volume, so stopping or recreating containers does not discard the database. Deleting the volume does.

For Java debugging, stop the Docker app, start only MySQL, and run `ModulithApplication` in IntelliJ. That JVM belongs to the IDE, not Docker, and must be stopped in the IDE. Automatic Spring Boot Compose startup is disabled to avoid launching a second app unexpectedly. The two application modes must not compete for port 8080.

## Tests and boundaries

`ModulithArchitectureTest` checks the module graph and generates documentation under `target/spring-modulith-docs`. Module verification catches cycles and access to another module's internal packages. An explicit regression checks that inventory's JPA entity and repository are not exposed module API. Public types in module root packages remain API by default; this is not a claim that every possible dependency is prohibited.

Unit/controller regressions use H2 for fast HTTP and transaction checks. `InventoryConcurrencyIT` uses an isolated MySQL Testcontainer to test stock consistency, optimistic conflicts, reversed cart ordering, and rollback of stock, orders, and event publications. Maven Failsafe runs `*IT` tests during `verify`. H2 results are not used as evidence of MySQL locking behavior.

## Deliberate limits

This is a local portfolio demonstration. It does not implement authentication, payments, shipping, real email, a persistent cart, or idempotent purchase requests. Its tested versioned migrations are not a complete production backup/rollback or zero-downtime deployment policy. Demo actions such as restocking are not suitable for an unauthenticated public deployment. A timed-out purchase can have an unknown outcome; check history before retrying.
