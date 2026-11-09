package com.portfolio.modulith;

import com.portfolio.modulith.inventory.internal.StockRepository;
import com.portfolio.modulith.order.OrderRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Fast HTTP/transaction regressions on H2; MySQL locking is covered separately by *IT. */
@SpringBootTest(properties = {
        "spring.docker.compose.enabled=false",
        "spring.flyway.enabled=false",
        "spring.datasource.url=jdbc:h2:mem:api-regressions;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.show-sql=false"
})
@AutoConfigureMockMvc
class BackendApiTest {
    @Autowired MockMvc mvc;
    @Autowired StockRepository stocks;
    @Autowired OrderRepository orders;
    @Autowired com.portfolio.modulith.order.OrderService orderService;
    @Autowired org.springframework.jdbc.core.JdbcTemplate jdbc;

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(booleans = {true, false})
    void failedCartRollsBackEveryStockOrderAndOutboxRow(boolean pessimistic) throws Exception {
        mvc.perform(post("/api/inventory/restock-all")).andExpect(status().isOk());
        Long publications = jdbc.queryForObject("select count(*) from event_publication", Long.class);
        org.junit.jupiter.api.Assertions.assertThrows(IllegalStateException.class, () -> orderService.checkout(
                java.util.List.of(new com.portfolio.modulith.order.OrderService.CartItem("AUDIO_PRO", 1),
                        new com.portfolio.modulith.order.OrderService.CartItem("FLASH_ITEM", 11)), pessimistic));
        assertThat(stocks.findByProductCode("AUDIO_PRO").orElseThrow().getQuantity()).isEqualTo(15);
        assertThat(stocks.findByProductCode("FLASH_ITEM").orElseThrow().getQuantity()).isEqualTo(10);
        assertThat(orders.count()).isZero();
        assertThat(jdbc.queryForObject("select count(*) from event_publication", Long.class)).isEqualTo(publications);
    }

    @org.junit.jupiter.api.AfterEach
    void awaitOutboxListeners() {
        org.awaitility.Awaitility.await().atMost(java.time.Duration.ofSeconds(10))
                .untilAsserted(() -> assertThat(jdbc.queryForObject(
                        "select count(*) from event_publication where completion_date is null", Long.class)).isZero());
    }

    @BeforeEach
    void cleanOrders() { orders.deleteAll(); }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.CsvSource(delimiter = '|', value = {
            "/api/orders | {'productCode':'FLASH_ITEM','quantity':0}",
            "/api/orders | {'productCode':'FLASH_ITEM','quantity':-2}",
            "/api/orders | {'productCode':' ','quantity':1}",
            "/api/orders | {'quantity':1}",
            "/api/inventory/restock | {'productCode':'FLASH_ITEM','quantity':-1}",
            "/api/inventory/restock | {'productCode':' ','quantity':1}",
            "/api/inventory/restock | {'quantity':1}",
            "/api/orders/checkout | {'items':[]}",
            "/api/orders/checkout | {}",
            "/api/orders/checkout | {'items':[null]}",
            "/api/orders/checkout | {'items':[{'productCode':' ','quantity':1}]}",
            "/api/orders/checkout | {'items':[{'quantity':1}]}",
            "/api/orders/checkout | {'items':[{'productCode':'FLASH_ITEM','quantity':0}]}"
    })
    void invalidRequestsReturnSafeBadRequest(String endpoint, String body) throws Exception {
        mvc.perform(post(endpoint).contentType(MediaType.APPLICATION_JSON).content(body.replace('\'', '"')))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value("ERROR"))
                .andExpect(jsonPath("$.error").isNotEmpty());
        assertThat(orders.count()).isZero();
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.CsvSource(delimiter = '|', value = {
            "/api/orders | {'productCode':'FLASH_ITEM','quantity':1.9}",
            "/api/orders/checkout | {'items':[{'productCode':'FLASH_ITEM','quantity':1.9}]}",
            "/api/inventory/restock | {'productCode':'FLASH_ITEM','quantity':1.9}"
    })
    void fractionalQuantitiesAreRejectedWithoutChangingState(String endpoint, String body) throws Exception {
        mvc.perform(post("/api/inventory/restock-all")).andExpect(status().isOk());
        Long publications = jdbc.queryForObject("select count(*) from event_publication", Long.class);
        mvc.perform(post(endpoint).contentType(MediaType.APPLICATION_JSON).content(body.replace('\'', '"')))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value("ERROR"));
        assertThat(stocks.findByProductCode("FLASH_ITEM").orElseThrow().getQuantity()).isEqualTo(10);
        assertThat(orders.count()).isZero();
        assertThat(jdbc.queryForObject("select count(*) from event_publication", Long.class)).isEqualTo(publications);
    }

    @Test
    void insufficientStockReturnsConflictWithoutPartialCheckout() throws Exception {
        mvc.perform(post("/api/inventory/restock-all")).andExpect(status().isOk());
        mvc.perform(post("/api/orders/checkout").contentType(MediaType.APPLICATION_JSON).content("""
                {"items":[{"productCode":"AUDIO_PRO","quantity":1},
                          {"productCode":"FLASH_ITEM","quantity":11}],"usePessimistic":true}
                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("Insufficient stock. Refresh inventory and try again."));
        assertThat(orders.count()).isZero();
        assertThat(stocks.findByProductCode("AUDIO_PRO").orElseThrow().getQuantity()).isEqualTo(15);
    }

    @Test
    void singleOrderEndpointStillWorksAndDefaultsToPessimistic() throws Exception {
        mvc.perform(post("/api/inventory/restock-all")).andExpect(status().isOk());
        mvc.perform(post("/api/orders").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productCode\":\"FLASH_ITEM\",\"quantity\":1}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.productCode").value("FLASH_ITEM"))
                .andExpect(jsonPath("$.quantity").value(1))
                .andExpect(jsonPath("$.status").value("CREATED"));
        assertThat(orders.count()).isEqualTo(1);
        assertThat(stocks.findByProductCode("FLASH_ITEM").orElseThrow().getQuantity()).isEqualTo(9);
    }

    @Test
    void unknownProductRollsBackPreviouslyProcessedCartItems() throws Exception {
        mvc.perform(post("/api/inventory/restock-all")).andExpect(status().isOk());
        mvc.perform(post("/api/orders/checkout").contentType(MediaType.APPLICATION_JSON).content("""
                {"items":[{"productCode":"AUDIO_PRO","quantity":1},
                          {"productCode":"UNKNOWN","quantity":1}]}
                """))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").isNotEmpty());
        assertThat(orders.count()).isZero();
        assertThat(stocks.findByProductCode("AUDIO_PRO").orElseThrow().getQuantity()).isEqualTo(15);
    }

    @Test
    void repeatedProductLinesCannotOversellOrPartiallyCommit() throws Exception {
        mvc.perform(post("/api/inventory/restock-all")).andExpect(status().isOk());
        mvc.perform(post("/api/orders/checkout").contentType(MediaType.APPLICATION_JSON).content("""
                {"items":[{"productCode":"FLASH_ITEM","quantity":6},
                          {"productCode":"FLASH_ITEM","quantity":6}]}
                """))
                .andExpect(status().isConflict());
        assertThat(orders.count()).isZero();
        assertThat(stocks.findByProductCode("FLASH_ITEM").orElseThrow().getQuantity()).isEqualTo(10);
    }

    @Test
    void checkoutReturnsOrdersAndDeductsAllItems() throws Exception {
        mvc.perform(post("/api/inventory/restock-all")).andExpect(status().isOk());
        mvc.perform(post("/api/orders/checkout").contentType(MediaType.APPLICATION_JSON).content("""
                {"items":[{"productCode":"FLASH_ITEM","quantity":2},
                          {"productCode":"AUDIO_PRO","quantity":3}],"usePessimistic":true}
                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].productCode").value("AUDIO_PRO"))
                .andExpect(jsonPath("$[0].status").value("CREATED"))
                .andExpect(jsonPath("$[1].orderNumber").isNotEmpty());
        assertThat(orders.count()).isEqualTo(2);
        assertThat(stocks.findByProductCode("FLASH_ITEM").orElseThrow().getQuantity()).isEqualTo(8);
        assertThat(stocks.findByProductCode("AUDIO_PRO").orElseThrow().getQuantity()).isEqualTo(12);
    }

    @Test
    void restockAllResetsDefaultsWhileSeedPreservesExistingQuantities() throws Exception {
        mvc.perform(post("/api/inventory/restock").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productCode\":\"FLASH_ITEM\",\"quantity\":2}"))
                .andExpect(status().isOk());
        mvc.perform(post("/api/inventory/seed")).andExpect(status().isOk());
        assertThat(stocks.findByProductCode("FLASH_ITEM").orElseThrow().getQuantity()).isEqualTo(2);

        mvc.perform(post("/api/inventory/restock-all")).andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.productCode == 'FLASH_ITEM')].quantity").value(10));
        assertThat(stocks.findByProductCode("FLASH_ITEM").orElseThrow().getQuantity()).isEqualTo(10);
    }
}
