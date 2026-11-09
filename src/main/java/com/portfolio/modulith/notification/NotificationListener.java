package com.portfolio.modulith.notification;

import com.portfolio.modulith.order.OrderCreatedEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentLinkedDeque;

@Component
public class NotificationListener {

    private static final Logger log = LoggerFactory.getLogger(NotificationListener.class);

    public record NotificationRecord(
            String orderNumber,
            String productCode,
            Integer quantity,
            String status,
            Instant timestamp,
            long processingTimeMs) {
    }

    // This feed is in memory and starts empty after a restart.
    private final ConcurrentLinkedDeque<NotificationRecord> eventLog = new ConcurrentLinkedDeque<>();

    public NotificationListener() {
    }

    public List<NotificationRecord> getRecentNotifications() {
        return new ArrayList<>(eventLog);
    }

    /**
     * Listens for OrderCreatedEvent.
     * 
     * Architectural Reason:
     * Using @ApplicationModuleListener instead of standard @EventListener + @Async
     * tells Spring Modulith to hook this into the Transactional Outbox.
     * It executes asynchronously in a separate transaction AFTER the original
     * order transaction commits. Failed processing leaves an incomplete publication
     * for explicit resubmission. This demo does not configure an automatic retry worker
     * and does not contact a real email server.
     */
    @ApplicationModuleListener
    public void onOrderCreated(OrderCreatedEvent event) throws InterruptedException {
        long startTime = System.currentTimeMillis();
        log.info("Received order event for outbox processing: {}", event.orderNumber());

        eventLog.addFirst(new NotificationRecord(
                event.orderNumber(),
                event.productCode(),
                event.quantity(),
                "RECEIVED_FROM_OUTBOX",
                Instant.now(),
                0));
        trimLog();

        // Demo only: sleep to simulate latency. No SMTP/API call or real email delivery occurs.
        Thread.sleep(1000);

        long duration = System.currentTimeMillis() - startTime;
        log.info("Simulated notification delivery completed for order: {} (took {}ms)", event.orderNumber(), duration);

        eventLog.addFirst(new NotificationRecord(
                event.orderNumber(),
                event.productCode(),
                event.quantity(),
                "SIMULATED_DELIVERY",
                Instant.now(),
                duration));
        trimLog();
    }

    private void trimLog() {
        while (eventLog.size() > 50) {
            eventLog.removeLast();
        }
    }
}
