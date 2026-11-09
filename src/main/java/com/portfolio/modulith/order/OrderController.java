package com.portfolio.modulith.order;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/orders")
@CrossOrigin(origins = "*", exposedHeaders = {"X-Page", "X-Page-Size", "X-Has-More"})
public class OrderController {

    private final OrderService orderService;

    public OrderController(OrderService orderService) {
        this.orderService = orderService;
    }

    public record PlaceOrderRequest(
            String productCode,
            int quantity,
            Boolean usePessimistic,
            String customerEmail
    ) {}

    @PostMapping
    public ResponseEntity<Order> createOrder(@RequestBody PlaceOrderRequest request) {
        // customerEmail is accepted for compatibility; no real email is sent.
        boolean pessimistic = request.usePessimistic() == null || request.usePessimistic();
        return ResponseEntity.ok(orderService.placeOrder(request.productCode(), request.quantity(), pessimistic));
    }

    public record CheckoutRequest(List<OrderService.CartItem> items, Boolean usePessimistic) {}

    @PostMapping("/checkout")
    public ResponseEntity<List<Order>> checkout(@RequestBody CheckoutRequest request) {
        boolean pessimistic = request.usePessimistic() == null || request.usePessimistic();
        return ResponseEntity.ok(orderService.checkout(request.items(), pessimistic));
    }

    @GetMapping
    public ResponseEntity<?> getOrders(@RequestParam(required = false) String page,
                                      @RequestParam(required = false) String size) {
        int pageNumber;
        int pageSize;
        try {
            pageNumber = page == null ? 0 : Integer.parseInt(page);
            pageSize = size == null ? 20 : Integer.parseInt(size);
        } catch (NumberFormatException exception) {
            return invalidPagination();
        }
        // JPA offsets are ints even though Pageable offsets are longs.
        if (pageNumber < 0 || pageSize < 1 || pageSize > 100
                || (long) pageNumber * pageSize > Integer.MAX_VALUE) {
            return invalidPagination();
        }
        var history = orderService.getOrders(pageNumber, pageSize);
        return ResponseEntity.ok()
                .header("X-Page", String.valueOf(history.getNumber()))
                .header("X-Page-Size", String.valueOf(history.getSize()))
                .header("X-Has-More", String.valueOf(history.hasNext()))
                .body(history.getContent());
    }

    private ResponseEntity<Map<String, String>> invalidPagination() {
        return ResponseEntity.badRequest().body(Map.of("status", "ERROR", "error",
                "Invalid pagination. Use a nonnegative page, a size from 1 to 100, and an offset no greater than 2147483647."));
    }
}
