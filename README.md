# ⚡ E-Commerce Modular Monolith

This repository contains a high-throughput, mathematically-verified **Modular Monolith** built with **Java 21** and **Spring Boot 3.x**. It simulates a robust e-commerce backend handling orders, inventory allocations, and asynchronous notifications.

## 🏗 System Architecture
The application is strictly divided into three isolated **Bounded Contexts**:
*   **`Order Module`**: The orchestrator. Manages the core business transaction and entity state lifecycle (`CREATED`, `PENDING`, `FAILED`).
*   **`Inventory Module`**: The source of truth for product stock. Designed specifically to handle high-concurrency race conditions.
*   **`Notification Module`**: A reactive boundary that listens to system events and safely dispatches external communications (e.g., email or SMS) without blocking the main thread.

---

## 🧠 The Engineering "Why"

### 1. High-Concurrency & "Flash Sales" (Pessimistic Locking)
In a standard read-heavy system, **Optimistic Locking** (`@Version`) is incredibly fast because it avoids database-level locks. However, during a highly-contested "Flash Sale" scenario, optimistic locking fails catastrophically—thousands of concurrent threads crash into each other resulting in massive `ObjectOptimisticLockingFailureException` rollbacks, connection pool starvation, and retry-loop overhead.

**The Solution:** For the `Inventory` module, we implemented a strict **Pessimistic Write Lock** (`SELECT ... FOR UPDATE`). This pushes the synchronization down to the MySQL row level. Threads are queued cleanly by the database engine, ensuring perfectly serialized stock deductions, absolutely zero "double-spending" or overselling, and no application-layer crashes.

### 2. Guaranteed Delivery (Transactional Outbox Pattern)
Slow external APIs (like email or payment gateways) should never block a core database transaction. However, using standard asynchronous events creates a dangerous gap: if the application crashes *after* the database commits but *before* the email thread executes, the notification is lost forever.

**The Solution:** We leverage the **Transactional Outbox Pattern** via Spring Modulith's `@ApplicationModuleListener`. When an `Order` is created, the `OrderCreatedEvent` is serialized into an `event_publication` database table within the *exact same transaction* as the order itself. The Notification module then processes this event asynchronously. If the email API goes down, the event remains safely in the database to be retried automatically. No data loss.

### 3. Bytecode-Verified Boundaries
Over time, Monoliths degrade into "Big Balls of Mud" because developers accidentally bypass domain APIs and tightly couple internal module packages. 

**The Solution:** We utilize **Spring Modulith's ArchUnit integration**. During the Maven `test` phase, the bytecode is mathematically analyzed. If a developer attempts to illegally autowire the `NotificationService` directly inside the `OrderService` (bypassing our event-driven API), the build will instantly fail. This strictly enforces our architectural schema and prevents technical debt accumulation. 

*(Check the `/documentation` folder for dynamically auto-generated PlantUML C4 diagrams of our validated architecture).*

---

## 🚀 Tech Stack
*   **Language:** Java 21
*   **Framework:** Spring Boot 3.2.x, Spring Data JPA, Spring Modulith
*   **Database:** MySQL 8.0 (ACID Compliant)
*   **Build Tool:** Maven