package com.portfolio.modulith.inventory;

import tools.jackson.databind.ObjectMapper;
import com.portfolio.modulith.ModulithApplication;
import com.portfolio.modulith.inventory.internal.Stock;
import com.portfolio.modulith.inventory.internal.StockRepository;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.MockMvc;

import java.lang.reflect.Modifier;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class InventoryValidationTest {
    @Nested
    @SpringBootTest(classes = ModulithApplication.class, properties = {
            "spring.docker.compose.enabled=false",
            "spring.flyway.enabled=false",
            "spring.datasource.url=jdbc:h2:mem:inventory-snapshots;DB_CLOSE_DELAY=-1",
            "spring.datasource.driver-class-name=org.h2.Driver",
            "spring.datasource.username=sa",
            "spring.datasource.password=",
            "spring.jpa.hibernate.ddl-auto=create-drop",
            "spring.jpa.show-sql=false"
    })
    @AutoConfigureMockMvc
    @DirtiesContext
    class StockApiPersistenceTest {
        @Autowired MockMvc mvc;
        @Autowired ObjectMapper mapper;

        @Test
        void restockSnapshotIncludesTheCommittedVersion() throws Exception {
            String restocked = mvc.perform(post("/api/inventory/restock")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"productCode\":\"FLASH_ITEM\",\"quantity\":9}"))
                    .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
            String current = mvc.perform(get("/api/inventory/FLASH_ITEM"))
                    .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();

            assertThat(mapper.readTree(restocked))
                    .as("The restock response must match the committed stock, including @Version")
                    .isEqualTo(mapper.readTree(current));
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {"list", "single", "restock"})
    void stockApiReturnsImmutableSnapshotsWithCompatibleJson(String operation) throws Exception {
        StockRepository repository = mock(StockRepository.class);
        InventoryService service = new InventoryService(repository);
        Stock stock = new Stock(7L, "FLASH_ITEM", 10, 3L);
        when(repository.findAll()).thenReturn(List.of(stock));
        when(repository.findByProductCode("FLASH_ITEM")).thenReturn(Optional.of(stock));
        when(repository.saveAndFlush(any(Stock.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Object snapshot = switch (operation) {
            case "list" -> service.getAllStock().getFirst();
            case "single" -> service.getStock("FLASH_ITEM").orElseThrow();
            case "restock" -> service.setStock("FLASH_ITEM", 10);
            default -> throw new IllegalArgumentException(operation);
        };
        ObjectMapper mapper = new ObjectMapper();
        var expectedJson = mapper.readTree("""
                {"id":7,"productCode":"FLASH_ITEM","quantity":10,"version":3}
                """);
        assertThat(mapper.readTree(mapper.writeValueAsString(snapshot))).isEqualTo(expectedJson);
        assertThat(snapshot.getClass().isRecord()).as("Stock API returns an immutable record, not a JPA entity").isTrue();
        assertThat(Modifier.isPublic(snapshot.getClass().getModifiers())).isTrue();

        stock.setId(8L);
        stock.setProductCode("CHANGED");
        stock.setQuantity(1);
        stock.setVersion(4L);
        assertThat(mapper.readTree(mapper.writeValueAsString(snapshot)))
                .as("The response must not track managed entity changes").isEqualTo(expectedJson);
    }

    @Test
    void rejectsBlankProductAndInvalidRestockBeforeDatabaseAccess() {
        StockRepository repository = mock(StockRepository.class);
        InventoryService service = new InventoryService(repository);
        assertThrows(IllegalArgumentException.class, () -> service.deductStock(" ", 1, true));
        assertThrows(IllegalArgumentException.class, () -> service.deductStock(null, 1, false));
        assertThrows(IllegalArgumentException.class, () -> service.setStock(" ", 1));
        assertThrows(IllegalArgumentException.class, () -> service.setStock("FLASH_ITEM", -1));
        assertThrows(IllegalArgumentException.class, () -> service.setStock("FLASH_ITEM", 0));
        verifyNoInteractions(repository);
    }

    @Test
    void rejectsNonPositiveDeductionBeforeAccessingDatabase() {
        StockRepository repository = mock(StockRepository.class);
        InventoryService service = new InventoryService(repository);
        when(repository.findPessimisticByProductCode("FLASH_ITEM"))
                .thenReturn(java.util.Optional.of(new Stock("FLASH_ITEM", 10)));

        assertThrows(IllegalArgumentException.class, () -> service.deductStock("FLASH_ITEM", -1, true));
        assertThrows(IllegalArgumentException.class, () -> service.deductStock("FLASH_ITEM", 0, true));
        verifyNoInteractions(repository);
    }
}
