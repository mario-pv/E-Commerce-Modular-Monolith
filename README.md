# E-Commerce Modular Monolith

I built this project to explore how a well-structured modular monolith handles the kind of backend problems that usually push teams toward microservices too early: flash-sale stock contention, atomic multi-item checkouts, and asynchronous post-purchase events.

The storefront itself is intentionally compact so the focus stays on what happens under the hood when ten buyers try to grab the last few units of a GPU at the exact same time, or when one item in a multi-item cart fails mid-checkout.

## Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Backend** | Java 21, Spring Boot 4.1.2, Spring Modulith 2.1.2, Spring Data JPA |
| **Database & Migrations** | MySQL 8.0, Flyway (versioned schema migrations with Hibernate `validate`) |
| **Frontend** | React 18, Vite, Tailwind CSS, Lucide Icons |
| **Testing & CI** | JUnit 5, Testcontainers (MySQL), Maven Failsafe, Vitest, React Testing Library, GitHub Actions |

## Architecture & Key Engineering Decisions

Instead of splitting `order`, `inventory`, and `notification` into separate deployables with network overhead, this app runs as a single Spring Boot deployment with strict package and module boundaries enforced by **Spring Modulith**:

- **Encapsulated Module Boundaries:** `OrderService` communicates synchronously with `InventoryService` for stock deductions, while JPA entities (`Stock`) and repositories (`StockRepository`) are tucked inside `inventory.internal`. External modules only ever see immutable `StockView` records, and `ModulithArchitectureTest` fails the build if another module tries to reach into internal persistence classes or introduce circular dependencies.
- **Pessimistic vs. Optimistic Concurrency Control:** High-contention flash sales and regular checkouts have different failure profiles. The backend supports both **Pessimistic Write Locking** (`SELECT ... FOR UPDATE` with a 3-second lock timeout to serialize competing deductions without retry storms) and **Optimistic Locking** (`@Version` on `Stock` to reject conflicting writes with a `409 Conflict`).
- **Atomic Cart Checkout & Deadlock Prevention:** Checking out a cart runs inside a single `@Transactional` boundary. If any item lacks sufficient stock, every prior stock deduction, order row, and outbox event from that checkout rolls back cleanly. To prevent database deadlocks when two carts check out the same products in reverse order, cart items are canonically sorted by `productCode` before acquiring row locks.
- **Transactional Outbox Notifications:** When an order commits, `OrderService` publishes an `OrderCreatedEvent`. Spring Modulith persists the event in the `event_publication` table within the same database transaction and dispatches it asynchronously after commit to `NotificationListener` (`@ApplicationModuleListener`), keeping slow notification work out of the checkout critical path.
- **Bounded Slice Pagination:** Order history (`GET /api/orders`) uses Spring Data `Slice` ordered by descending ID rather than `Page`, fetching `size + 1` rows to populate `X-Page`, `X-Page-Size`, and `X-Has-More` headers without firing an expensive full-table `COUNT(*)` query on every poll.
- **Production-Minded Schema Management:** Flyway manages all physical MySQL schema transitions (`V1__legacy_schema.sql` and `V2__modulith_publication_lifecycle.sql`), while Hibernate runs strictly in `ddl-auto: validate` mode.

## Try It Out (Interactive Demo Features)

Once the app is running, you can test the backend behavior directly from the UI:

1. **Flash Rush Simulator:** Pick any in-stock item, choose **5, 10, or 20 concurrent HTTP requests**, and toggle between **Pessimistic** and **Optimistic** locking to compare how the database handles simultaneous buyers competing for limited inventory.
2. **Atomic Cart Rollback:** Add two different products to your cart, or try purchasing more units than are currently in stock, to see how whole-cart validation and transactional rollback behave.
3. **Observability Dashboard:** Switch to the **Observability** view to watch persisted orders (newest-first pagination) alongside the live after-commit notification feed updating every 2 seconds.
4. **One-Click Inventory Reset:** Use **Restock demo inventory** at any time to reset catalog stock back to baseline quantities without wiping out your order history.

## Running Locally

### Option 1: Docker Compose (Recommended for a quick spin)

All you need is Docker Desktop. The multi-stage `Dockerfile` compiles the React frontend and packages the Java 21 JAR inside the container, so you don't need Node or Maven installed on your host machine.

```powershell
# Build and start both the Spring Boot app and MySQL 8.0
docker compose up --build -d --wait

# Check container health
docker compose ps
```

Open `http://localhost:8080` in your browser.

```powershell
# Stop the stack without losing database volume data
docker compose stop

# Start existing containers again
docker compose start --wait

# Follow application logs
docker compose logs -f app
```

*Note: MySQL data persists in the named `modulith-mysql-data` volume. Avoid running `docker compose down -v` unless you want to wipe the database.*

### Option 2: Local Java (IntelliJ / Maven) + MySQL in Docker

If you want to step through the Java code in a debugger, run MySQL in Docker and launch Spring Boot on your host (requires **JDK 21**):

```powershell
# Stop the containerized app if it's running on port 8080, then start only MySQL
docker compose stop
docker compose up -d --wait mysql

# Run the backend (use ./mvnw on macOS/Linux or .\mvnw.cmd on Windows)
./mvnw spring-boot:run
```

If you're working on the React UI (`frontend/`), open a second terminal (requires **Node 22.12+ / 24+**):

```powershell
cd frontend
npm ci
npm run dev
```

Vite runs at `http://localhost:5173` and proxies `/api` requests to `localhost:8080`. When you're ready to bundle the UI into Spring Boot's static assets (`src/main/resources/static`), run `npm run build` inside `frontend/`.

> **Upgrading an older local pre-Flyway database?** Fresh setups work automatically. If you have an existing non-empty volume from an earlier version of this repo without Flyway history, startup will intentionally halt to protect your data. Follow the one-time adoption steps in [docs/database-migrations.md](https://www.google.com/search?q=docs/database-migrations.md) using the `local-db-upgrade` profile.

## Testing & Verification

The test suite separates fast feedback from real database concurrency checks, and everything runs in GitHub Actions on every push and pull request:

- **Fast Unit, Controller & Architecture Tests (`./mvnw test`):** Uses H2 and MockMvc to test input validation, safe HTTP `400`/`409`/`500` error envelopes (`ApiExceptionHandler`), slice pagination query counts, and Spring Modulith package encapsulation (`ModulithArchitectureTest`).
- **Real MySQL Concurrency & Migration Integration Tests (`./mvnw verify`):** Uses **Testcontainers** (`mysql:8.0.44`) via Maven Failsafe to verify InnoDB pessimistic row serialization, deterministic optimistic version conflicts (`CyclicBarrier`), deadlock-free reversed cart checkouts, full rollback of `event_publication` outbox records, and Flyway upgrades from legacy schemas (`InventoryConcurrencyIT`, `SchemaMigrationIT`).
- **Frontend Suite (`cd frontend && npm test`):** Uses Vitest and React Testing Library to cover atomic cart checkout flows, Flash Rush Simulator modes, pagination race conditions, offline safeguards, and static asset publishing.

## Project Structure

```text
src/main/java/com/portfolio/modulith/
├── ModulithApplication.java      # Spring Boot entry point (@EnableAsync)
├── ApiExceptionHandler.java      # Consistent, leak-free HTTP error responses
├── order/                        # Checkout API, transaction orchestration, OrderCreatedEvent
├── inventory/                    # Catalog API, StockView DTO, and internal Stock JPA entity/locks
└── notification/                 # @ApplicationModuleListener consumer and activity feed
src/main/resources/db/migration/  # Versioned Flyway SQL migrations (V1, V2)
frontend/src/                     # React + Tailwind storefront, Rush Simulator, Observability UI
src/test/java/                    # ArchUnit/Modulith checks, MockMvc tests, MySQL Testcontainers ITs
```

## Scope & Honest Tradeoffs

This repository is a focused architecture and concurrency demo rather than a full retail platform:

- **Simulated External Side Effects:** The notification listener simulates delivery latency (`Thread.sleep`) and pushes events to a bounded in-memory feed for the UI; no real emails are sent, and no payment gateway is attached.
- **Demo Controls:** Endpoints like `/api/inventory/restock-all` are unauthenticated so reviewers can easily reset state during testing.
- **Deeper Reading:** Check out [ARCHITECTURE.md](ARCHITECTURE.md) for a closer look at the transaction flow, lock tradeoffs, and database schema details.
