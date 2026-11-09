package com.portfolio.modulith.inventory;

import com.portfolio.modulith.inventory.internal.Stock;
import com.portfolio.modulith.inventory.internal.StockRepository;
import com.portfolio.modulith.order.OrderRepository;
import com.portfolio.modulith.order.OrderService;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.MySQLContainer;

import java.util.*;
import java.util.concurrent.*;
import java.util.function.IntFunction;
import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.*;

/** Real InnoDB regressions run by Failsafe during verify. Docker is required, not silently skipped. */
@SpringBootTest(properties = {
    "spring.docker.compose.enabled=false", "spring.flyway.enabled=false", "spring.jpa.hibernate.ddl-auto=create-drop",
    "spring.jpa.show-sql=false", "spring.datasource.hikari.maximum-pool-size=20"
})
@Import(InventoryConcurrencyIT.MysqlConfiguration.class)
@org.springframework.test.annotation.DirtiesContext
@Timeout(90)
class InventoryConcurrencyIT {
    @TestConfiguration(proxyBeanMethods = false)
    static class MysqlConfiguration {
        @Bean
        @ServiceConnection
        MySQLContainer<?> mysql() {
            // Spring owns the lifecycle: database outlives datasource and Modulith shutdown callbacks.
            return new MySQLContainer<>("mysql:8.0.44").withDatabaseName("checkout_it")
                    .withCommand("--innodb-lock-wait-timeout=10");
        }
    }

    @Autowired InventoryService inventory;
    @Autowired StockRepository stocks;
    @Autowired OrderService orders;
    @Autowired OrderRepository orderRepository;
    @Autowired PlatformTransactionManager transactionManager;
    @Autowired JdbcTemplate jdbc;

    @BeforeEach
    void setup() {
        orderRepository.deleteAll();
        stocks.deleteAll();
        stocks.save(new Stock("FLASH_ITEM", 10));
        stocks.save(new Stock("AUDIO_PRO", 10));
    }

    @AfterEach
    void awaitOutboxListenersBeforeStoppingDatabase() {
        org.awaitility.Awaitility.await().atMost(java.time.Duration.ofSeconds(15))
                .untilAsserted(() -> assertThat(jdbc.queryForObject(
                        "select count(*) from event_publication where completion_date is null", Long.class)).isZero());
    }

    @Test
    void pessimisticLockingSerializesAllSuccessfulDeductions() throws Exception {
        List<Boolean> results = concurrently(10, i -> () -> {
            inventory.deductStock("FLASH_ITEM", 1, true);
            return true;
        });
        assertThat(results).containsOnly(true);
        assertThat(quantity("FLASH_ITEM")).isZero();
    }

    @Test
    void pessimisticLockingPreventsOverselling() throws Exception {
        List<Boolean> results = concurrently(16, i -> () -> {
            try {
                inventory.deductStock("FLASH_ITEM", 1, true);
                return true;
            } catch (IllegalStateException soldOut) { return false; }
        });
        assertThat(results.stream().filter(Boolean::booleanValue).count()).isEqualTo(10);
        assertThat(quantity("FLASH_ITEM")).isZero();
    }

    @Test
    void optimisticVersionConflictIsDeterministicAndDoesNotOversell() throws Exception {
        CyclicBarrier bothReadSameVersion = new CyclicBarrier(2);
        List<Boolean> results = concurrently(2, i -> () -> {
            try {
                new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
                    stocks.findByProductCode("FLASH_ITEM").orElseThrow();
                    await(bothReadSameVersion);
                    // Same persistence context reuses the already-read version in each transaction.
                    inventory.deductStock("FLASH_ITEM", 1, false);
                });
                return true;
            } catch (OptimisticLockingFailureException expectedConflict) { return false; }
        });
        assertThat(results).containsExactlyInAnyOrder(true, false);
        assertThat(quantity("FLASH_ITEM")).isEqualTo(9);
    }

    @Test
    void optimisticCartConflictRollsBackTheEntireLosingCart() throws Exception {
        CyclicBarrier bothReadSameVersions = new CyclicBarrier(2);
        Long before = jdbc.queryForObject("select count(*) from event_publication", Long.class);
        List<OrderService.CartItem> cart = List.of(new OrderService.CartItem("AUDIO_PRO", 1),
                new OrderService.CartItem("FLASH_ITEM", 1));
        List<Boolean> results = concurrently(2, i -> () -> {
            try {
                new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
                    stocks.findByProductCode("AUDIO_PRO").orElseThrow();
                    stocks.findByProductCode("FLASH_ITEM").orElseThrow();
                    await(bothReadSameVersions);
                    orders.checkout(cart, false);
                });
                return true;
            } catch (OptimisticLockingFailureException expectedConflict) { return false; }
        });
        assertThat(results).containsExactlyInAnyOrder(true, false);
        assertThat(quantity("AUDIO_PRO")).isEqualTo(9);
        assertThat(quantity("FLASH_ITEM")).isEqualTo(9);
        assertThat(orderRepository.count()).isEqualTo(2);
        assertThat(jdbc.queryForObject("select count(*) from event_publication", Long.class)).isEqualTo(before + 2);
    }

    @Test
    void reversedCartsUseConsistentLockOrderAndNeverPartiallyCommit() throws Exception {
        List<OrderService.CartItem> forward = List.of(new OrderService.CartItem("AUDIO_PRO", 1),
                new OrderService.CartItem("FLASH_ITEM", 1));
        List<OrderService.CartItem> reverse = List.of(forward.get(1), forward.get(0));
        List<Boolean> results = concurrently(12, i -> () -> {
            try {
                assertThat(orders.checkout(i % 2 == 0 ? forward : reverse, true)).hasSize(2);
                return true;
            } catch (IllegalStateException soldOut) { return false; }
        });
        assertThat(results.stream().filter(Boolean::booleanValue).count()).isEqualTo(10);
        assertThat(quantity("FLASH_ITEM")).isZero();
        assertThat(quantity("AUDIO_PRO")).isZero();
        assertThat(orderRepository.count()).isEqualTo(20);
    }

    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    void failedCheckoutRollsBackInventoryOrdersAndOutboxOnMysql(boolean pessimistic) {
        Long before = jdbc.queryForObject("select count(*) from event_publication", Long.class);
        assertThrows(IllegalStateException.class, () -> orders.checkout(List.of(
                new OrderService.CartItem("AUDIO_PRO", 2),
                new OrderService.CartItem("FLASH_ITEM", 11)), pessimistic));
        assertThat(quantity("AUDIO_PRO")).isEqualTo(10);
        assertThat(quantity("FLASH_ITEM")).isEqualTo(10);
        assertThat(orderRepository.count()).isZero();
        assertThat(jdbc.queryForObject("select count(*) from event_publication", Long.class)).isEqualTo(before);
    }

    private int quantity(String code) { return stocks.findByProductCode(code).orElseThrow().getQuantity(); }

    private static void await(CyclicBarrier barrier) {
        try { barrier.await(10, TimeUnit.SECONDS); }
        catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new AssertionError("Interrupted waiting for concurrent readers", ex);
        } catch (BrokenBarrierException | TimeoutException ex) {
            throw new AssertionError("Both readers did not reach the barrier", ex);
        }
    }

    private static <T> List<T> concurrently(int workers, IntFunction<Callable<T>> task) throws Exception {
        ExecutorService executor = Executors.newFixedThreadPool(workers);
        CountDownLatch ready = new CountDownLatch(workers);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<T>> futures = new ArrayList<>();
        try {
            for (int i = 0; i < workers; i++) {
                Callable<T> operation = task.apply(i);
                futures.add(executor.submit(() -> {
                    ready.countDown();
                    assertTrue(start.await(10, TimeUnit.SECONDS), "Timed out waiting to start");
                    return operation.call();
                }));
            }
            assertTrue(ready.await(10, TimeUnit.SECONDS), "Workers failed to initialize");
            start.countDown();
            List<T> results = new ArrayList<>();
            for (Future<T> future : futures) results.add(future.get(30, TimeUnit.SECONDS));
            return results;
        } finally {
            start.countDown();
            futures.forEach(future -> future.cancel(true));
            executor.shutdownNow();
            assertTrue(executor.awaitTermination(10, TimeUnit.SECONDS), "Executor leaked worker threads");
        }
    }
}
