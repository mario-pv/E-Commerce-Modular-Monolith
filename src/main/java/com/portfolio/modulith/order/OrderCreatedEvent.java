package com.portfolio.modulith.order;

/**
 * Domain Event representing a successfully created order.
 * This is published to trigger asynchronous side-effects (like notifications)
 * without coupling the Order context to downstream modules.
 */
public record OrderCreatedEvent(String orderNumber, String productCode, Integer quantity) {
}
