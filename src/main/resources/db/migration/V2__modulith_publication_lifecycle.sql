-- Spring Modulith 2.1 JPA publication fields. Preserve all event identifiers,
-- payloads, listener/type names, timestamps, orders, and stock.
ALTER TABLE event_publication
    ADD COLUMN completion_attempts INT NOT NULL DEFAULT 0,
    ADD COLUMN last_resubmission_date DATETIME(6) NULL,
    ADD COLUMN status ENUM('COMPLETED', 'FAILED', 'PROCESSING', 'PUBLISHED', 'RESUBMITTED') NULL;

-- An incomplete pre-upgrade publication is retryable, not currently processing.
UPDATE event_publication
SET status = CASE WHEN completion_date IS NOT NULL THEN 'COMPLETED' ELSE 'FAILED' END;
