package com.portfolio.modulith.inventory;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class InventoryDataInitializer implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(InventoryDataInitializer.class);

    private final InventoryService inventoryService;

    public InventoryDataInitializer(InventoryService inventoryService) {
        this.inventoryService = inventoryService;
    }

    @Override
    public void run(String... args) {
        log.info("Running InventoryDataInitializer to ensure default catalog stock exists...");
        inventoryService.seedInitialStock();
    }
}
