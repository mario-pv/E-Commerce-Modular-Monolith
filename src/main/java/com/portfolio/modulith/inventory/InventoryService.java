package com.portfolio.modulith.inventory;

import com.portfolio.modulith.inventory.internal.Stock;
import com.portfolio.modulith.inventory.internal.StockRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.TreeMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class InventoryService {

    private static final Logger log = LoggerFactory.getLogger(InventoryService.class);

    private final StockRepository stockRepository;

    public InventoryService(StockRepository stockRepository) {
        this.stockRepository = stockRepository;
    }

    /**
     * Deducts stock for a given product. 
     * Allows toggling between Optimistic and Pessimistic locking for demonstration.
     *
     * @param productCode      The unique product identifier
     * @param quantityToDeduct Amount to remove from available stock
     * @param usePessimistic   If true, uses SELECT FOR UPDATE. If false, relies on @Version.
     */
    @Transactional
    public void deductStock(String productCode, int quantityToDeduct, boolean usePessimistic) {
        requireProductCode(productCode);
        if (quantityToDeduct <= 0) {
            throw new IllegalArgumentException("Quantity must be positive");
        }
        log.info("Attempting to deduct {} units of {} (Pessimistic Lock: {})", 
                 quantityToDeduct, productCode, usePessimistic);

        Stock stock = usePessimistic 
                ? stockRepository.findPessimisticByProductCode(productCode)
                    .orElseThrow(() -> new IllegalArgumentException("Product not found: " + productCode))
                : stockRepository.findByProductCode(productCode)
                    .orElseThrow(() -> new IllegalArgumentException("Product not found: " + productCode));

        if (stock.getQuantity() < quantityToDeduct) {
            throw new IllegalStateException("Insufficient stock for product: " + productCode);
        }

        stock.setQuantity(stock.getQuantity() - quantityToDeduct);
        
        // Dirty checking flushes changes and verifies @Version on flush/commit.
        // A surrounding checkout transaction may still roll back every deduction.
        log.info("Staged stock deduction. Pending quantity for {}: {}", productCode, stock.getQuantity());
    }

    private static void requireProductCode(String productCode) {
        if (productCode == null || productCode.isBlank()) {
            throw new IllegalArgumentException("Product code must not be blank");
        }
    }

    @Transactional(readOnly = true)
    public List<StockView> getAllStock() {
        return stockRepository.findAll().stream().map(InventoryService::toStockView).toList();
    }

    @Transactional(readOnly = true)
    public Optional<StockView> getStock(String productCode) {
        return stockRepository.findByProductCode(productCode).map(InventoryService::toStockView);
    }

    @Transactional
    public StockView setStock(String productCode, int quantity) {
        requireProductCode(productCode);
        if (quantity <= 0) {
            throw new IllegalArgumentException("Quantity must be positive");
        }
        // This replaces the quantity; it does not add to the current stock.
        Stock stock = stockRepository.findByProductCode(productCode)
                .orElse(Stock.builder().productCode(productCode).quantity(quantity).build());
        stock.setQuantity(quantity);
        // Capture the updated optimistic-lock version, not the pre-flush entity state.
        return toStockView(stockRepository.saveAndFlush(stock));
    }

    private static StockView toStockView(Stock stock) {
        return new StockView(stock.getId(), stock.getProductCode(), stock.getQuantity(), stock.getVersion());
    }

    private static Map<String, Integer> defaultStock() {
        Map<String, Integer> defaults = new TreeMap<>();
        defaults.put("FLASH_ITEM", 10);
        defaults.put("RTX_5090", 5);
        defaults.put("MECH_KEYBOARD", 25);
        defaults.put("OLED_DISPLAY", 8);
        defaults.put("AUDIO_PRO", 15);
        defaults.put("SMART_HUB", 20);
        defaults.put("MOUSE_TITAN", 30);

        return defaults;
    }

    @Transactional
    public void restockAll() {
        // Reset known demo products only; custom products and orders are preserved.
        for (Map.Entry<String, Integer> entry : defaultStock().entrySet()) {
            setStock(entry.getKey(), entry.getValue());
        }
    }

    @Transactional
    public void seedInitialStock() {
        Map<String, Integer> defaults = defaultStock();
        // Keep existing quantities when the app starts or the seed endpoint is called.
        for (Map.Entry<String, Integer> entry : defaults.entrySet()) {
            if (stockRepository.findByProductCode(entry.getKey()).isEmpty()) {
                stockRepository.save(Stock.builder()
                        .productCode(entry.getKey())
                        .quantity(entry.getValue())
                        .build());
                log.info("Seeded initial inventory for {} with quantity {}", entry.getKey(), entry.getValue());
            }
        }
    }
}
