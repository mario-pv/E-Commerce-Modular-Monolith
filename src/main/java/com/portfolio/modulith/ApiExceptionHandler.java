package com.portfolio.modulith;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import java.util.Map;

/** Client responses contain stable, safe messages, never database/stack-trace details. */
@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> invalidRequest(IllegalArgumentException exception) {
        return error(400, "Invalid request. Provide existing, nonblank product codes and positive quantities.");
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<Map<String, String>> stockConflict(IllegalStateException exception) {
        return error(409, "Insufficient stock. Refresh inventory and try again.");
    }

    @ExceptionHandler({org.springframework.dao.ConcurrencyFailureException.class,
            jakarta.persistence.OptimisticLockException.class,
            jakarta.persistence.PessimisticLockException.class,
            jakarta.persistence.LockTimeoutException.class,
            org.springframework.dao.DataIntegrityViolationException.class})
    public ResponseEntity<Map<String, String>> concurrentConflict(RuntimeException exception) {
        return error(409, "Inventory changed concurrently. Refresh inventory and try again.");
    }

    @ExceptionHandler(org.springframework.http.converter.HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, String>> malformedBody(RuntimeException exception) {
        return error(400, "Malformed request body.");
    }

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<Map<String, String>> unexpectedFailure(RuntimeException exception) {
        org.slf4j.LoggerFactory.getLogger(ApiExceptionHandler.class).error("Request failed", exception);
        return error(500, "Unable to complete request. Please try again later.");
    }

    private ResponseEntity<Map<String, String>> error(int status, String message) {
        return ResponseEntity.status(status).body(Map.of("status", "ERROR", "error", message));
    }
}
