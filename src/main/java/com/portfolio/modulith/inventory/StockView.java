package com.portfolio.modulith.inventory;

/** Immutable stock snapshot exposed by the inventory module. */
public record StockView(Long id, String productCode, Integer quantity, Long version) {}
