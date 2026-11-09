package com.portfolio.modulith.inventory.internal;

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

    public Stock(String productCode, Integer quantity) {
        this.productCode = productCode;
        this.quantity = quantity;
    }

    public static StockBuilder builder() {
        return new StockBuilder();
    }

    public static class StockBuilder {
        private Long id;
        private String productCode;
        private Integer quantity;
        private Long version;

        public StockBuilder id(Long id) { this.id = id; return this; }
        public StockBuilder productCode(String productCode) { this.productCode = productCode; return this; }
        public StockBuilder quantity(Integer quantity) { this.quantity = quantity; return this; }
        public StockBuilder version(Long version) { this.version = version; return this; }
        public Stock build() { return new Stock(id, productCode, quantity, version); }
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getProductCode() { return productCode; }
    public void setProductCode(String productCode) { this.productCode = productCode; }
    public Integer getQuantity() { return quantity; }
    public void setQuantity(Integer quantity) { this.quantity = quantity; }
    public Long getVersion() { return version; }
    public void setVersion(Long version) { this.version = version; }
}
