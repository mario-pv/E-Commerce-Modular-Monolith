package com.portfolio.modulith.notification;

import com.portfolio.modulith.order.OrderCreatedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class NotificationListener {

    /**
     * Listens for OrderCreatedEvent.
     * 
     * Architectural Reason:
     * Using @ApplicationModuleListener instead of standard @EventListener + @Async 
     * tells Spring Modulith to hook this into the Transactional Outbox.
     * It executes asynchronously in a separate transaction AFTER the original 
     * order transaction commits. If this method fails (e.g., the email server is down), 
     * the original order is NOT rolled back, and the event remains in the 
     * event_publication database table to be retried later.
     */
    @ApplicationModuleListener
    public void onOrderCreated(OrderCreatedEvent event) throws InterruptedException {
        log.info("Received order event for outbox processing: {}", event.orderNumber());
        
        // Simulate a slow external network call (e.g., SMTP server or SendGrid API)
        Thread.sleep(1000);
        
        log.info("Notification successfully dispatched for order: {}", event.orderNumber());
    }
}
