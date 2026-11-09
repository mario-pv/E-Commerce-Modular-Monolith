package com.portfolio.modulith;

import com.portfolio.modulith.inventory.internal.Stock;
import com.portfolio.modulith.order.Order;
import com.portfolio.modulith.order.OrderCreatedEvent;
import com.portfolio.modulith.order.OrderService;
import jakarta.persistence.EntityManagerFactory;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.core.env.Environment;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.NestedTestConfiguration;
import org.testcontainers.containers.MySQLContainer;

import java.time.Duration;
import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.springframework.test.context.NestedTestConfiguration.EnclosingConfiguration.OVERRIDE;

/** Real Flyway + Hibernate startup against isolated MySQL, never the developer datasource. */
class SchemaMigrationIT {
    abstract static class DatabaseChecks {
        @Autowired JdbcTemplate jdbc;
        @Autowired EntityManagerFactory entityManagerFactory;
        @Autowired Environment environment;

        void assertVersionedMigrations(String firstMigrationType) {
            assertThat(environment.getProperty("spring.jpa.hibernate.ddl-auto")).isEqualTo("validate");
            assertThat(jdbc.queryForList(
                    "select version from flyway_schema_history where success = true order by installed_rank",
                    String.class)).containsExactly("1", "2");
            assertThat(jdbc.queryForObject(
                    "select type from flyway_schema_history where version = '1'", String.class))
                    .isEqualTo(firstMigrationType);
            assertThat(jdbc.queryForObject(
                    "select type from flyway_schema_history where version = '2'", String.class)).isEqualTo("SQL");
        }
    }

    @Nested
    @NestedTestConfiguration(OVERRIDE)
    @SpringBootTest(properties = {
            "spring.docker.compose.enabled=false",
            "spring.modulith.events.republish-outstanding-events-on-restart=false"
    })
    @ActiveProfiles("local-db-upgrade")
    @Import(LegacyDatabase.MysqlConfiguration.class)
    @DirtiesContext
    class LegacyDatabase extends DatabaseChecks {
        @TestConfiguration(proxyBeanMethods = false)
        static class MysqlConfiguration {
            @Bean
            @ServiceConnection
            MySQLContainer<?> mysql() {
                return new MySQLContainer<>("mysql:8.0.44")
                        .withDatabaseName("legacy_schema_it")
                        .withInitScript("db/legacy-schema.sql");
            }
        }

        @Test
        void upgradesLegacySchemaAndBackfillsOutboxWithoutLosingData() {
            assertThat(jdbc.queryForObject(
                    "select status from event_publication where completion_date is not null", String.class))
                    .isEqualTo("COMPLETED");
            assertThat(jdbc.queryForObject(
                    "select status from event_publication where completion_date is null", String.class))
                    .isEqualTo("FAILED");
            assertVersionedMigrations("BASELINE");

            assertThat(jdbc.queryForObject("select count(*) from event_publication", Long.class)).isEqualTo(2);
            assertThat(jdbc.queryForList("select completion_attempts from event_publication", Integer.class))
                    .containsExactly(0, 0);
            assertThat(jdbc.queryForList("select last_resubmission_date from event_publication", Object.class))
                    .containsOnlyNulls();
            assertThat(jdbc.queryForList("select hex(id) from event_publication order by id", String.class))
                    .containsExactly("00000000000000000000000000000001", "00000000000000000000000000000002");
            assertThat(jdbc.queryForList("select publication_date from event_publication", LocalDateTime.class))
                    .containsOnly(LocalDateTime.parse("2025-01-02T03:04:05.123456"));
            assertThat(jdbc.queryForObject("select completion_date from event_publication where status = 'COMPLETED'",
                    LocalDateTime.class)).isEqualTo(LocalDateTime.parse("2025-01-02T03:04:06.654321"));
            assertThat(jdbc.queryForList("select listener_id from event_publication", String.class))
                    .containsOnly("com.portfolio.modulith.notification.NotificationListener.onOrderCreated("
                            + "com.portfolio.modulith.order.OrderCreatedEvent)");

            try (var em = entityManagerFactory.createEntityManager()) {
                Stock stock = em.find(Stock.class, 41L);
                assertThat(stock.getProductCode()).isEqualTo("FLASH_ITEM");
                assertThat(stock.getQuantity()).isEqualTo(7);
                assertThat(stock.getVersion()).isEqualTo(3);
                Order order = em.find(Order.class, 73L);
                assertThat(order.getOrderNumber()).isEqualTo("legacy-order-73");
                assertThat(order.getProductCode()).isEqualTo("FLASH_ITEM");
                assertThat(order.getQuantity()).isEqualTo(2);
                assertThat(order.getStatus()).isEqualTo("CREATED");
                assertThat(em.createQuery("select p.eventType from DefaultJpaEventPublication p", Class.class)
                        .getResultList()).containsOnly(OrderCreatedEvent.class);
                assertThat(em.createQuery("select p.serializedEvent from DefaultJpaEventPublication p", String.class)
                        .getResultList()).containsOnly(
                                "{\"orderNumber\":\"legacy-order-73\",\"productCode\":\"FLASH_ITEM\",\"quantity\":2}");
            }
            assertThat(jdbc.queryForObject("select column_default from information_schema.columns "
                    + "where table_schema = database() and table_name = 'event_publication' "
                    + "and column_name = 'completion_attempts'", String.class)).isEqualTo("0");
        }
    }

    @Nested
    @NestedTestConfiguration(OVERRIDE)
    @SpringBootTest(properties = {"spring.docker.compose.enabled=false"})
    @Import(FreshDatabase.MysqlConfiguration.class)
    @DirtiesContext
    class FreshDatabase extends DatabaseChecks {
        @Autowired OrderService orders;

        @TestConfiguration(proxyBeanMethods = false)
        static class MysqlConfiguration {
            @Bean
            @ServiceConnection
            MySQLContainer<?> mysql() {
                return new MySQLContainer<>("mysql:8.0.44").withDatabaseName("fresh_schema_it");
            }
        }

        @Test
        void migratesEmptyDatabaseBeforeHibernateValidationAndPersistsNewOutboxEvents() {
            assertVersionedMigrations("SQL");
            assertThat(environment.getProperty("spring.flyway.baseline-on-migrate", Boolean.class, false)).isFalse();
            assertThat(jdbc.queryForObject("select count(*) from order_orders", Long.class)).isZero();
            assertThat(jdbc.queryForObject("select count(*) from event_publication", Long.class)).isZero();
            Order order = orders.placeOrder("FLASH_ITEM", 1);
            assertThat(order.getId()).isPositive();
            await().atMost(Duration.ofSeconds(15)).untilAsserted(() -> {
                assertThat(jdbc.queryForObject("select status from event_publication", String.class))
                        .isEqualTo("COMPLETED");
                assertThat(jdbc.queryForObject("select event_type from event_publication", String.class))
                        .isEqualTo(OrderCreatedEvent.class.getName());
                assertThat(jdbc.queryForObject("select completion_date is not null from event_publication", Boolean.class))
                        .isTrue();
            });
        }
    }
}
