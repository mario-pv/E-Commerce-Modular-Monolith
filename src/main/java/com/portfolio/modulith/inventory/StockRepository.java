package com.portfolio.modulith.inventory;

import jakarta.persistence.LockModeType;
import jakarta.persistence.QueryHint;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.QueryHints;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface StockRepository extends JpaRepository<Stock, Long> {

    // 1. Optimistic Locking Path (relies on the @Version field in Stock entity)
    Optional<Stock> findByProductCode(String productCode);

    /**
     * 2. Pessimistic Locking Path
     *
     * Architectural Reason: 
     * In highly concurrent "flash sale" scenarios, optimistic locking creates massive 
     * rollback and retry overhead because transactions frequently collide. 
     * By applying a PESSIMISTIC_WRITE lock, we instruct MySQL to place an exclusive 
     * row-level lock (SELECT ... FOR UPDATE) on the database row. 
     * Concurrent threads must queue and wait for the lock to be released, 
     * ensuring strict serialization of stock deductions and eliminating race conditions 
     * without application-level retry loops.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @QueryHints({@QueryHint(name = "jakarta.persistence.lock.timeout", value = "3000")})
    @Query("SELECT s FROM Stock s WHERE s.productCode = :productCode")
    Optional<Stock> findPessimisticByProductCode(@Param("productCode") String productCode);
}
