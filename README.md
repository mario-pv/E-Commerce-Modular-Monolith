# E-Commerce Modular Monolith

[![Verify](https://github.com/mario-pv/E-Commerce-Modular-Monolith/actions/workflows/verify.yml/badge.svg)](https://github.com/mario-pv/E-Commerce-Modular-Monolith/actions/workflows/verify.yml)

A local portfolio demo of transactional checkout, stock concurrency, and asynchronous events, built with Java 21, Spring Boot, Spring Modulith, MySQL, and React.

Dependency baseline: Spring Boot **4.1.2**, Spring Modulith **2.1.2**, and Boot-managed Testcontainers. Flyway manages versioned MySQL schema changes; Hibernate validates the schema rather than changing it implicitly.

The storefront is deliberately small. The interesting part is what happens when several buyers try to purchase the same stock, or one item in a cart cannot be fulfilled.

## What works

- Browse the backend's demo catalog, search/filter products, and manage a cart.
- Check out the entire cart in one transaction: a failed item rolls back all stock deductions, orders, and event publications from that checkout.
- Run ten concurrent purchase requests with pessimistic or optimistic locking and inspect actual successes/failures.
- Reset demo stock to its starting quantities without deleting order history.
- Browse persisted orders with bounded, newest-first pagination and view recent simulated notification activity.
- Reject blank product codes, zero/negative or fractional purchase quantities, and insufficient stock with useful API errors.

Notifications are simulated; no email is sent. Offline mode is catalog preview only, not a simulated database or a successful purchase.

## Run locally

**Upgrading an existing demo database?** Read [the one-time database adoption steps](docs/database-migrations.md) before starting the upgraded app. Fresh databases work normally. An existing non-empty database without Flyway history is deliberately rejected until you explicitly adopt it; do not delete its volume to bypass this check.

### Docker Desktop: app and database together (recommended for reviewing)

Only Docker Desktop with Linux containers is required. The multi-stage Dockerfile builds the React frontend and Java 21 backend inside Docker, so it does not use an old host JAR.

From the project root in PowerShell:

```powershell
docker compose up --build -d --wait
docker compose ps
```

Open `http://localhost:8080`. In Docker Desktop, expand **e-commerce-modular-monolith** to see **modulith-app** and **modulith-mysql**, including health status and logs.

```powershell
# Stop the WHOLE project: app and database, without deleting data.
docker compose stop

# Start the existing containers again.
docker compose start --wait

# Rebuild and run after changing source code.
docker compose up --build -d --wait

# See stopped containers too, or follow the app's logs.
docker compose ps -a
docker compose logs -f app
```

In Docker Desktop, use Start/Stop on the **project/group row** to control both services. Stopping only the MySQL row does not automatically stop Java; the app then remains visible in its own row. `depends_on` waits for MySQL health during startup, not continuous lifecycle coupling. Stop the whole group when you want port 8080 to close. Ctrl+C while following logs stops the log viewer, not detached containers.

Both services use `restart: "no"`; neither is configured to respawn automatically. Ports are bound to localhost. MySQL data is stored in the named volume `modulith-mysql-data`, which survives normal stop/start and `docker compose down`. **Do not use `docker compose down -v` unless you intend to delete the database.**

### IntelliJ or Maven: app on the host, database in Docker

Use this mode for debugging Java. It needs JDK 21 and Maven (or the included wrapper). Do not run the Docker app and the IDE app together on port 8080.

```powershell
# First stop any full-stack Docker run.
docker compose stop
# Start only MySQL.
docker compose up -d --wait mysql

java -version
javac -version
mvn -version
# All three should select Java 21.
mvn spring-boot:run
```

Alternatively run `ModulithApplication` in IntelliJ. Use IntelliJ's red **Stop** button to stop that Java process, or Ctrl+C for a foreground Maven/JAR run. Docker does not own an IDE/terminal-launched Java process and cannot stop it. Spring's automatic Compose startup is disabled, so an IDE launch cannot silently start another app container.

The Windows Maven wrapper can replace `mvn` with `.\mvnw.cmd`; on macOS/Linux use `./mvnw`.

Host configuration defaults to MySQL on port 3306, database `ecommerce_db`, and `root`/`root`. Override `DB_URL`, `DB_USERNAME`, and `DB_PASSWORD` for a host run when needed. Container connection settings are in `compose.yaml`. All defaults are for local development only.

### Frontend development

With either backend mode running, use another terminal. This needs Node 22.12+, 24.x, or 26+ and npm; see `frontend/package.json` for the exact range.

```powershell
cd frontend
npm ci
npm run dev
```

Open `http://localhost:5173`; Vite proxies `/api` to port 8080. To publish frontend changes for a host Maven/JAR run:

```powershell
npm run build
```

Restart/repackage a host backend as needed. For Docker, rebuild with `docker compose up --build -d --wait` instead; the Dockerfile builds and packages both frontend and backend from source.

### Package a host JAR

Build the frontend first if it changed, then run from the root with only MySQL running:

```powershell
mvn verify
java -jar target/modulith-0.0.1-SNAPSHOT.jar
```

This Java process is owned by its terminal, not Docker. Keep the terminal visible and stop it with Ctrl+C. `mvn verify` requires Docker for isolated MySQL integration tests; those tests do not clear the developer database.

## Try a short demo

1. Click **Restock demo inventory** to start with the default quantities.
2. Add two different products to the cart, check out, and inspect the returned order numbers.
3. Open **Observability** to see persisted orders and the simulated after-commit notification feed.
4. Restock, open **Flash Rush Simulator**, choose the flash product, and run ten pessimistic-lock requests. Restock again and compare optimistic mode. Exact optimistic outcomes depend on transaction overlap; deterministic conflicts are also covered in integration tests.
5. Open **Architecture** for the transaction/event flow.

Restocking resets stock, not orders. Stop the Docker project/group with `docker compose stop`; for an IDE/terminal app, also stop its separate Java process. Restarting the app clears the in-memory notification feed; database state remains in the named MySQL volume.

## Tests

GitHub Actions runs the frontend tests/build and the complete Maven verification lifecycle on pushes to `main` and pull requests. MySQL integration tests require Docker and are not silently skipped. Actions are pinned to immutable commit SHAs; Dependabot proposes weekly Maven, npm, and Actions updates for review.

```powershell
# Architecture, HTTP/transaction regressions, and real MySQL concurrency tests
mvn verify

# Frontend behavior and static-file publishing regressions
cd frontend
npm test
npm run build
```

`mvn test` runs the fast tests. Maven Failsafe runs `*IT` integration tests during `mvn verify`. Tests cover whole-cart rollback, optimistic conflicts, pessimistic oversell prevention, lock ordering, restock, validation, module encapsulation, paginated history, and simulated notification labeling. Frontend tests cover checkout, errors, offline safeguards, the simulator, observability, pagination, and publishing assets safely.

`GET /api/orders?page=0&size=20` returns a JSON array ordered by descending order ID, with `X-Page`, `X-Page-Size`, and `X-Has-More` headers. Page numbers start at zero; page size must be 1–100 (default 20). The UI offers Previous/Next navigation. This is live offset pagination, not a frozen audit snapshot: concurrent purchases can shift records between pages.

## Read the code

```text
src/main/java/com/portfolio/modulith/
  ModulithApplication.java      Spring Boot entry point; async listeners enabled
  order/                       Purchase API, transaction coordination, orders/events
  inventory/                   Stock, locks, demo catalog, seed/reset operations
  notification/                After-commit event consumer and recent activity feed
frontend/src/                  React components and API client
src/main/resources/static/     Compiled frontend served by Spring Boot
src/test/                      Backend regression and MySQL integration tests
```

Start with `OrderController` -> `OrderService` -> `InventoryService`, then follow `OrderCreatedEvent` into `NotificationListener`. See `ARCHITECTURE.md` for the current data model and tradeoffs. Architecture tests generate fresh diagrams in `target/spring-modulith-docs`; checked-in `documentation/` files are snapshots, not the authoritative implementation.

## Scope and tradeoffs

This is not a production store. Product names/specifications/prices are fictional sample data. There are no payments, accounts, shipping, real email, persistent cart, or automatic purchase retries. The order model stores one product per row, while cart rows commit together. The notification feed is not a durable outbox dashboard. Real MySQL migration tests cover both fresh databases and preserved legacy data.

The stock-reset APIs are unauthenticated demo controls, and CORS is permissive. Run locally; add authentication, authorization, deployment hardening, a production migration/backup policy, and request idempotency before exposing it publicly. If a purchase times out, check order history before retrying because the server may already have committed it.
