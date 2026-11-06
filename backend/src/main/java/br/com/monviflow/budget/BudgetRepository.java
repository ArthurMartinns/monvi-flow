package br.com.monviflow.budget;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.*;

public interface BudgetRepository extends JpaRepository<Budget, Long> {
    @Modifying(flushAutomatically = true)
    @Query(value = "DELETE FROM budget WHERE user_id = :userId AND category_id = :categoryId", nativeQuery = true)
    int deleteByUserIdAndCategoryId(Long userId, Long categoryId);

    Optional<Budget> findByIdAndUserId(Long id, Long userId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            INSERT INTO budget (user_id, category_id, month, limit_amount) VALUES (:userId, :categoryId, :month, :amount)
            ON CONFLICT (user_id, category_id, month) DO UPDATE SET limit_amount = EXCLUDED.limit_amount
            """, nativeQuery = true)
    void saveLimit(Long userId, Long categoryId, LocalDate month, BigDecimal amount);

    @Query(value = """
            SELECT b.id, b.category_id AS categoryId, c.name AS categoryName, b.limit_amount AS limitAmount,
                   COALESCE(SUM(t.amount), 0) AS spent,
                   b.limit_amount - COALESCE(SUM(t.amount), 0) AS remaining
            FROM budget b JOIN category c ON c.id = b.category_id
            LEFT JOIN financial_transaction t ON t.category_id = b.category_id AND t.user_id = b.user_id
                 AND t.date >= b.month AND t.date < :until
            WHERE b.user_id = :userId AND b.month = :month
            GROUP BY b.id, c.id ORDER BY c.name, b.id
            """, nativeQuery = true)
    List<Summary> findSummaries(Long userId, LocalDate month, LocalDate until);

    interface Summary {
        Long getId();

        Long getCategoryId();

        String getCategoryName();

        BigDecimal getLimitAmount();

        BigDecimal getSpent();

        BigDecimal getRemaining();
    }
}
