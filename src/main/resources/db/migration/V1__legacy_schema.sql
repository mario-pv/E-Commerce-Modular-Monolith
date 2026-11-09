-- Snapshot of the original Hibernate-managed schema. Existing local databases
-- are explicitly baselined at version 1; only empty databases execute this SQL.
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
