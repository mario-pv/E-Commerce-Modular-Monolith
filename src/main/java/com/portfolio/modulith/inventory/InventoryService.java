package com.portfolio.modulith.inventory;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class InventoryService {

    private final StockRepository stockRepository;

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
        
        // Dirty checking automatically updates the database at the end of the transaction.
        // For optimistic locking, JPA will automatically verify the version column here.
        log.info("Successfully deducted stock. New quantity for {}: {}", productCode, stock.getQuantity());
    }
}
