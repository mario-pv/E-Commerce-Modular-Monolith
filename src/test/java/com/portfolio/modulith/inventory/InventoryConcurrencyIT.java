package com.portfolio.modulith.inventory;

import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@Slf4j
class InventoryConcurrencyIT {

    @Autowired
    private InventoryService inventoryService;

    @Autowired
    private StockRepository stockRepository;

    @BeforeEach
    void setUp() {
        stockRepository.deleteAll();
        stockRepository.save(Stock.builder()
                .productCode("FLASH_ITEM")
                .quantity(10)
                .build());
    }

    @Test
    void testOptimisticLocking_shouldThrowExceptionsAndPreventOversell() throws InterruptedException {
        int threadCount = 10;
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        CountDownLatch readyLatch = new CountDownLatch(threadCount);
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(threadCount);
        
        AtomicInteger failedThreads = new AtomicInteger(0);

        // Architectural Note: We are simulating a Flash Sale spike. 
        // 10 concurrent requests hitting the DB at the exact same millisecond.
        for (int i = 0; i < threadCount; i++) {
            executor.submit(() -> {
                try {
                    readyLatch.countDown();
                    startLatch.await(); // Wait at the starting line
                    // false = Use Optimistic Locking
                    inventoryService.deductStock("FLASH_ITEM", 1, false);
                } catch (Exception e) {
                    log.info("Optimistic lock failure caught: {}", e.getClass().getSimpleName());
                    failedThreads.incrementAndGet();
                } finally {
                    doneLatch.countDown();
                }
            });
        }

        readyLatch.await();     // Wait for all threads to initialize
        startLatch.countDown(); // Unleash the horde (Trigger concurrency)
        doneLatch.await();      // Wait for all to finish

        Stock finalStock = stockRepository.findByProductCode("FLASH_ITEM").orElseThrow();
        log.info("Final stock after Optimistic locking test: {}", finalStock.getQuantity());
        
        // Assertions
        assertTrue(failedThreads.get() > 0, "Expected at least one thread to fail due to Optimistic Locking version mismatch");
        assertTrue(finalStock.getQuantity() > 0, "Stock should not be zero because some concurrent transactions were aborted");
    }

    @Test
    void testPessimisticLocking_shouldSerializeAndSucceed() throws InterruptedException {
        int threadCount = 10;
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        CountDownLatch readyLatch = new CountDownLatch(threadCount);
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(threadCount);
        
        AtomicInteger failedThreads = new AtomicInteger(0);

        // Architectural Note: Even with 10 threads hammering the database,
        // the SELECT ... FOR UPDATE will queue them at the database level.
        for (int i = 0; i < threadCount; i++) {
            executor.submit(() -> {
                try {
                    readyLatch.countDown();
                    startLatch.await();
                    // true = Use Pessimistic Write Locking
                    inventoryService.deductStock("FLASH_ITEM", 1, true);
                } catch (Exception e) {
                    log.error("Unexpected failure in Pessimistic locking: ", e);
                    failedThreads.incrementAndGet();
                } finally {
                    doneLatch.countDown();
                }
            });
        }

        readyLatch.await();
        startLatch.countDown();
        doneLatch.await();

        Stock finalStock = stockRepository.findByProductCode("FLASH_ITEM").orElseThrow();
        log.info("Final stock after Pessimistic locking test: {}", finalStock.getQuantity());
        
        // Assertions
        assertEquals(0, failedThreads.get(), "Expected zero failures with Pessimistic Locking");
        assertEquals(0, finalStock.getQuantity(), "Stock should be exactly zero as all threads successfully updated serially");
    }
}
