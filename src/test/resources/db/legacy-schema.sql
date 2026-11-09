-- Exact pre-Flyway / Spring Modulith 1.x table shape, intentionally without 2.x fields.
CREATE TABLE inventory_stock (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    product_code VARCHAR(255) NOT NULL UNIQUE,
    quantity INT NOT NULL,
    version BIGINT
) ENGINE=InnoDB;

CREATE TABLE order_orders (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    order_number VARCHAR(255) NOT NULL UNIQUE,
    product_code VARCHAR(255) NOT NULL,
    quantity INT NOT NULL,
    status VARCHAR(255) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE event_publication (
    id BINARY(16) NOT NULL PRIMARY KEY,
    publication_date DATETIME(6) NOT NULL,
    listener_id VARCHAR(255) NOT NULL,
    serialized_event VARCHAR(255) NOT NULL,
    event_type VARCHAR(255) NOT NULL,
    completion_date DATETIME(6)
) ENGINE=InnoDB;

INSERT INTO inventory_stock (id, product_code, quantity, version)
VALUES (41, 'FLASH_ITEM', 7, 3);
INSERT INTO order_orders (id, order_number, product_code, quantity, status)
VALUES (73, 'legacy-order-73', 'FLASH_ITEM', 2, 'CREATED');
INSERT INTO event_publication
    (id, publication_date, listener_id, serialized_event, event_type, completion_date)
VALUES
    (UNHEX('00000000000000000000000000000001'), '2025-01-02 03:04:05.123456',
     'com.portfolio.modulith.notification.NotificationListener.onOrderCreated(com.portfolio.modulith.order.OrderCreatedEvent)',
     '{"orderNumber":"legacy-order-73","productCode":"FLASH_ITEM","quantity":2}',
     'com.portfolio.modulith.order.OrderCreatedEvent', '2025-01-02 03:04:06.654321'),
    (UNHEX('00000000000000000000000000000002'), '2025-01-02 03:04:05.123456',
     'com.portfolio.modulith.notification.NotificationListener.onOrderCreated(com.portfolio.modulith.order.OrderCreatedEvent)',
     '{"orderNumber":"legacy-order-73","productCode":"FLASH_ITEM","quantity":2}',
     'com.portfolio.modulith.order.OrderCreatedEvent', NULL);
