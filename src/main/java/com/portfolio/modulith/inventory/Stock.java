package com.portfolio.modulith.inventory;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "inventory_stock")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Stock {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String productCode;

    @Column(nullable = false)
    private Integer quantity;

    /**
     * Optimistic Locking Version.
     * Spring Data JPA uses this field to detect concurrent modifications.
     * If two transactions read the same version and attempt to update it,
     * the first will succeed, and the second will throw an ObjectOptimisticLockingFailureException.
     */
    @Version
    private Long version;
}
