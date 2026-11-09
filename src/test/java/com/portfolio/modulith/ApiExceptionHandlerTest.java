package com.portfolio.modulith;

import com.portfolio.modulith.order.OrderController;
import com.portfolio.modulith.order.OrderService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.CannotAcquireLockException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class ApiExceptionHandlerTest {
    OrderService service;
    MockMvc mvc;

    @BeforeEach
    void setup() {
        service = mock(OrderService.class);
        mvc = MockMvcBuilders.standaloneSetup(new OrderController(service))
                .setControllerAdvice(new ApiExceptionHandler()).build();
    }

    @Test
    void optimisticCommitConflictIsSafe409() throws Exception {
        when(service.placeOrder("FLASH_ITEM", 1, true))
                .thenThrow(new ObjectOptimisticLockingFailureException("SECRET_DATABASE_TABLE", 1));
        requestOrder(409, "Inventory changed concurrently. Refresh inventory and try again.");
    }

    @Test
    void lockTimeoutIsSafe409() throws Exception {
        when(service.placeOrder("FLASH_ITEM", 1, true)).thenThrow(new CannotAcquireLockException("SECRET_SQL"));
        requestOrder(409, "Inventory changed concurrently. Refresh inventory and try again.");
    }

    @Test
    void unexpectedFailureDoesNotExposeInternalDetails() throws Exception {
        when(service.placeOrder("FLASH_ITEM", 1, true)).thenThrow(new RuntimeException("SECRET_CREDENTIAL"));
        requestOrder(500, "Unable to complete request. Please try again later.");
    }

    @Test
    void malformedJsonIsSafe400() throws Exception {
        mvc.perform(post("/api/orders").contentType(MediaType.APPLICATION_JSON).content("{\"quantity\":\"invalid\"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("Malformed request body."));
    }

    private void requestOrder(int statusCode, String message) throws Exception {
        mvc.perform(post("/api/orders").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productCode\":\"FLASH_ITEM\",\"quantity\":1}"))
                .andExpect(status().is(statusCode))
                .andExpect(jsonPath("$.status").value("ERROR"))
                .andExpect(jsonPath("$.error").value(message));
    }
}
