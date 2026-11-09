package com.portfolio.modulith.order;

import com.portfolio.modulith.inventory.InventoryService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Slice;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class OrderService {

    private static final Logger log = LoggerFactory.getLogger(OrderService.class);

    private final OrderRepository orderRepository;
    private final InventoryService inventoryService;
    private final ApplicationEventPublisher eventPublisher;

    public OrderService(OrderRepository orderRepository,
            InventoryService inventoryService,
            ApplicationEventPublisher eventPublisher) {
        this.orderRepository = orderRepository;
        this.inventoryService = inventoryService;
        this.eventPublisher = eventPublisher;
    }

    /**
     * Orchestrates the order placement process using default pessimistic locking.
     */
    @Transactional
    public Order placeOrder(String productCode, int quantity) {
        return placeOrder(productCode, quantity, true);
    }

    /**
     * Orchestrates the order placement process with selectable locking strategy.
     * 
     * Architectural Reason:
     * This method is @Transactional. It calls the InventoryService synchronously
     * to guarantee stock is deducted before we commit the order to the database.
     * Once the order is saved, it publishes an OrderCreatedEvent. Spring Modulith
     * intercepts this event and persists it in the event_publication table within
     * the SAME transaction (Transactional Outbox Pattern). Incomplete publications
     * can be explicitly resubmitted after a failure; persistence alone does not
     * guarantee delivery or configure automatic retries.
     */
    @Transactional
    public Order placeOrder(String productCode, int quantity, boolean usePessimistic) {
        String orderNumber = UUID.randomUUID().toString();
        log.info("Placing order {} for {}x {} (Pessimistic Lock: {})", orderNumber, quantity, productCode,
                usePessimistic);

        // 1. Synchronous inter-module call (Order -> Inventory)
        // Uses pessimistic or optimistic lock to deduct stock
        inventoryService.deductStock(productCode, quantity, usePessimistic);

        // 2. Persist the Order State
        Order order = Order.builder()
                .orderNumber(orderNumber)
                .productCode(productCode)
                .quantity(quantity)
                .status("CREATED")
                .build();
        order = orderRepository.save(order);
        log.info("Order {} persisted, pending transaction commit.", orderNumber);

        // 3. Fire domain event for asynchronous listeners (Order -> Notification)
        OrderCreatedEvent event = new OrderCreatedEvent(orderNumber, productCode, quantity);
        eventPublisher.publishEvent(event);
        log.info("Published OrderCreatedEvent for {}", orderNumber);

        return order;
    }

    public record CartItem(String productCode, int quantity) {
    }

    @Transactional
    public List<Order> checkout(List<CartItem> items, boolean usePessimistic) {
        if (items == null || items.isEmpty()) {
            throw new IllegalArgumentException("Cart must contain at least one item");
        }
        for (CartItem item : items) {
            if (item == null || item.productCode() == null || item.productCode().isBlank() || item.quantity() <= 0) {
                throw new IllegalArgumentException("Every item requires a product code and positive quantity");
            }
        }
        // Canonical lock ordering: sort by productCode to enforce a deterministic
        // lock acquisition order across concurrent transactions and prevent deadlocks.
        return items.stream()
                .sorted(java.util.Comparator.comparing(CartItem::productCode))
                .map(item -> placeOrder(item.productCode(), item.quantity(), usePessimistic))
                .toList();
    }

    @Transactional(readOnly = true)
    public Slice<Order> getOrders(int page, int size) {
        return orderRepository.findAllBy(PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "id")));
    }
}
