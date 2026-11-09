package com.portfolio.modulith.order;

import tools.jackson.databind.ObjectMapper;
import org.hibernate.SessionFactory;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import jakarta.persistence.EntityManagerFactory;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Repository fixtures avoid order events and asynchronous notification listeners. */
@SpringBootTest(properties = {
        "spring.flyway.enabled=false",
        "spring.docker.compose.enabled=false",
        "spring.datasource.url=jdbc:h2:mem:order-history;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.show-sql=false",
        "spring.jpa.properties.hibernate.generate_statistics=true",
        "logging.level.org.hibernate.engine.internal.StatisticalLoggingSessionEventListener=OFF"
})
@AutoConfigureMockMvc
class OrderHistoryApiTest {
    @Autowired MockMvc mvc;
    @Autowired OrderRepository orders;
    @Autowired ObjectMapper mapper;
    @Autowired EntityManagerFactory entityManagerFactory;

    @BeforeEach
    void clearOrders() {
        orders.deleteAllInBatch();
    }

    @Test
    void defaultHistoryIsAnArrayOfTwentyNewestOrdersWithSliceMetadataAndNoCount() throws Exception {
        List<Order> fixtures = insertOrders(25);
        var statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        statistics.clear();

        String body = mvc.perform(get("/api/orders"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$.length()").value(20))
                .andExpect(header().string("X-Page", "0"))
                .andExpect(header().string("X-Page-Size", "20"))
                .andExpect(header().string("X-Has-More", "true"))
                .andReturn().getResponse().getContentAsString();

        List<Long> expectedIds = new ArrayList<>(fixtures.stream().map(Order::getId).toList());
        Collections.reverse(expectedIds);
        assertThat(mapper.readTree(body).findValues("id").stream().map(node -> String.valueOf(node.longValue())).toList())
                .containsExactlyElementsOf(expectedIds.subList(0, 20).stream().map(String::valueOf).toList());
        // A Slice fetches only size + 1 rows; a Page would execute an additional count query.
        assertThat(statistics.getEntityLoadCount()).isEqualTo(21);
        assertThat(statistics.getQueryExecutionCount()).isEqualTo(1);
    }

    @Test
    void olderPagesAreDeterministicAndCanReachTheFinalAndEmptySlices() throws Exception {
        List<Order> fixtures = insertOrders(5);
        for (int page = 0; page < 4; page++) {
            var result = mvc.perform(get("/api/orders").param("page", String.valueOf(page)).param("size", "2"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$").isArray())
                    .andExpect(header().string("X-Page", String.valueOf(page)))
                    .andExpect(header().string("X-Page-Size", "2"))
                    .andExpect(header().string("X-Has-More", String.valueOf(page < 2)))
                    .andReturn();
            List<String> expected = new ArrayList<>();
            for (int index = 4 - page * 2; index >= 0 && expected.size() < 2; index--) {
                expected.add(String.valueOf(fixtures.get(index).getId()));
            }
            assertThat(mapper.readTree(result.getResponse().getContentAsString()).findValues("id").stream()
                    .map(node -> String.valueOf(node.longValue())).toList())
                    .containsExactlyElementsOf(expected);
        }
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.CsvSource(delimiter = '|', value = {
            "page | -1", "page | not-a-number", "page | 1.5", "page | 2147483648",
            "page | 2147483647", "page | ''", "page | ' '",
            "size | -1", "size | 0", "size | 101", "size | not-a-number",
            "size | 1.5", "size | 2147483648", "size | ''", "size | ' '"
    })
    void invalidPaginationReturnsSafeBadRequestWithoutQueryingHistory(String parameter, String value) throws Exception {
        var statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        statistics.clear();
        mvc.perform(get("/api/orders").param(parameter, value))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value("ERROR"))
                .andExpect(jsonPath("$.error").value(
                        "Invalid pagination. Use a nonnegative page, a size from 1 to 100, and an offset no greater than 2147483647."));
        assertThat(statistics.getQueryExecutionCount()).isZero();
    }

    @Test
    void paginationMetadataIsReadableByCrossOriginClients() throws Exception {
        mvc.perform(get("/api/orders").header("Origin", "http://localhost:5173"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Expose-Headers", "X-Page, X-Page-Size, X-Has-More"))
                .andExpect(header().string("X-Page", "0"))
                .andExpect(header().string("X-Has-More", "false"))
                .andExpect(content().json("[]"));
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(ints = {1, 100})
    void acceptsBothSizeBoundsAndDoesNotReportMoreOnAnExactlyFullFinalPage(int size) throws Exception {
        insertOrders(size);
        mvc.perform(get("/api/orders").param("size", String.valueOf(size)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(size))
                .andExpect(header().string("X-Page-Size", String.valueOf(size)))
                .andExpect(header().string("X-Has-More", "false"));
    }

    private List<Order> insertOrders(int count) {
        List<Order> fixtures = new ArrayList<>();
        for (int index = 0; index < count; index++) {
            fixtures.add(Order.builder()
                    .orderNumber("HISTORY-" + index)
                    .productCode("FLASH_ITEM")
                    .quantity(1)
                    .status("CREATED")
                    .build());
        }
        return orders.saveAllAndFlush(fixtures);
    }
}
