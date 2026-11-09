package com.portfolio.modulith.inventory;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/inventory")
@CrossOrigin(origins = "*")
public class InventoryController {

    private final InventoryService inventoryService;

    public InventoryController(InventoryService inventoryService) {
        this.inventoryService = inventoryService;
    }

    @GetMapping
    public ResponseEntity<List<StockView>> getInventory() {
        return ResponseEntity.ok(inventoryService.getAllStock());
    }

    @GetMapping("/{productCode}")
    public ResponseEntity<?> getStock(@PathVariable String productCode) {
        return inventoryService.getStock(productCode)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    public record RestockRequest(String productCode, int quantity) {}

    @PostMapping("/restock")
    public ResponseEntity<?> restock(@RequestBody RestockRequest request) {
        StockView stock = inventoryService.setStock(request.productCode(), request.quantity());
        return ResponseEntity.ok(stock);
    }

    @PostMapping("/restock-all")
    public ResponseEntity<List<StockView>> restockAll() {
        inventoryService.restockAll();
        return ResponseEntity.ok(inventoryService.getAllStock());
    }

    @PostMapping("/seed")
    public ResponseEntity<?> seed() {
        inventoryService.seedInitialStock();
        return ResponseEntity.ok(inventoryService.getAllStock());
    }
}
