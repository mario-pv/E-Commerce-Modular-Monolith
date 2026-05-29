# Architecture: E-Commerce Modular Monolith

## 1. System Overview
This project is a high-performance, strictly structured Modular Monolith built with **Java 21** and **Spring Boot 3.x**. It models an E-commerce Order Management and Inventory Allocation system. 

By leveraging **Spring Modulith**, we enforce strict bounded contexts at the package level, ensuring that modules only communicate through approved APIs or asynchronous application events.

## 2. Technology Stack
*   **Language:** Java 21
*   **Framework:** Spring Boot 3.x, Spring Modulith, Spring Data JPA
*   **Database:** MySQL (Relational, ACID, Row-level locking)
*   **Build Tool:** Maven

## 3. Bounded Contexts & Module Interactions

### Modules
1.  **`orders`**: Manages the core order state machine (`PENDING`, `APPROVED`, `CANCELLED`).
2.  **`inventory`**: The source of truth for stock levels and reservations. Highly concurrent.
3.  **`notifications`**: A reactive module that listens to system events and dispatches messages (e.g., emails/SMS).

### Interaction Flow
*   **Synchronous Allocation (Order ➔ Inventory):** When an order is placed, the `orders` module synchronously invokes the `inventory` module's exposed API to reserve stock. This ensures immediate feedback if stock is insufficient.
*   **Asynchronous Decoupling (Order ➔ Notifications):** Upon successful stock reservation and order persistence, the `orders` module publishes an `OrderPlacedEvent`. The `notifications` module listens via `@ApplicationModuleListener` and processes the event asynchronously (and transactionally), ensuring the core order thread isn't blocked by slow email servers.

## 4. Proposed Database Schema (MySQL)

To maintain logical separation within our single MySQL database, we prefix tables by module.

### Order Module Schema
```sql
CREATE TABLE order_orders (
    id BINARY(16) PRIMARY KEY,
    customer_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL, -- PENDING, APPROVED, REJECTED
    total_amount DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE order_items (
    id BINARY(16) PRIMARY KEY,
    order_id BINARY(16) NOT NULL,
    product_id VARCHAR(255) NOT NULL,
    quantity INT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES order_orders(id)
);
```

### Inventory Module Schema
```sql
CREATE TABLE inventory_stock (
    product_id VARCHAR(255) PRIMARY KEY,
    available_quantity INT NOT NULL,
    reserved_quantity INT NOT NULL DEFAULT 0,
    version BIGINT NOT NULL DEFAULT 0 -- Used for Optimistic Locking
);
```

## 5. Concurrency Strategy
Handling concurrent flash sales requires strict database locking strategies to prevent overselling.

*   **Optimistic Locking (`@Version`):** The `inventory_stock.version` column acts as an optimistic lock. If two concurrent threads attempt to purchase the same item, the first to commit updates the version. The second thread will fail with an `ObjectOptimisticLockingFailureException`, which we can catch and retry.
*   **Pessimistic Locking (`SELECT ... FOR UPDATE`):** For absolute critical paths (e.g., allocating highly contested flash-sale items), Spring Data JPA's `@Lock(LockModeType.PESSIMISTIC_WRITE)` translates to a row-level MySQL lock. This forces sequential access to that specific `product_id` row until the transaction commits.
