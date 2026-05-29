package com.portfolio.modulith.order;

import com.portfolio.modulith.inventory.InventoryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class OrderService {

    private final OrderRepository orderRepository;
    private final InventoryService inventoryService;
    private final ApplicationEventPublisher eventPublisher;

    /**
     * Orchestrates the order placement process.
     * 
     * Architectural Reason: 
     * This method is @Transactional. It calls the InventoryService synchronously 
     * to guarantee stock is deducted before we commit the order to the database.
     * Once the order is saved, it publishes an OrderCreatedEvent. Spring Modulith 
     * intercepts this event and persists it in the event_publication table within 
     * the SAME transaction (Transactional Outbox Pattern). This guarantees our 
     * Notification module will eventually process it, even if the app crashes 
     * immediately after this method completes.
     */
    @Transactional
    public Order placeOrder(String productCode, int quantity) {
        String orderNumber = UUID.randomUUID().toString();
        log.info("Placing order {} for {}x {}", orderNumber, quantity, productCode);

        // 1. Synchronous inter-module call (Order -> Inventory)
        // Uses the pessimistic lock to guarantee stock safety under high load.
        inventoryService.deductStock(productCode, quantity, true);

        // 2. Persist the Order State
        Order order = Order.builder()
                .orderNumber(orderNumber)
                .productCode(productCode)
                .quantity(quantity)
                .status("CREATED")
                .build();
        order = orderRepository.save(order);
        log.info("Order {} successfully persisted in database.", orderNumber);

        // 3. Fire domain event for asynchronous listeners (Order -> Notification)
        OrderCreatedEvent event = new OrderCreatedEvent(orderNumber, productCode, quantity);
        eventPublisher.publishEvent(event);
        log.info("Published OrderCreatedEvent for {}", orderNumber);

        return order;
    }
}
