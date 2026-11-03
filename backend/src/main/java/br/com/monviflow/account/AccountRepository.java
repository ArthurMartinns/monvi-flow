package br.com.monviflow.account;

import java.util.List;
import java.util.Optional;
import java.math.BigDecimal;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface AccountRepository extends JpaRepository<Account, Long> {
    Optional<Account> findByIdAndUserId(Long id, Long userId);

    @Query(value = """
            SELECT a.id, a.name, a.initial_balance AS initialBalance,
                   a.initial_balance + COALESCE(SUM(
                       CASE WHEN c.type = 'INCOME' THEN t.amount ELSE -t.amount END
                   ), 0) AS currentBalance
            FROM account a
            LEFT JOIN financial_transaction t ON t.account_id = a.id
            LEFT JOIN category c ON c.id = t.category_id
            WHERE a.user_id = :userId AND (CAST(:id AS bigint) IS NULL OR a.id = :id)
            GROUP BY a.id
            ORDER BY a.id
            """, nativeQuery = true)
    List<Summary> findSummaries(Long userId, Long id);

    interface Summary {
        Long getId();
        String getName();
        BigDecimal getInitialBalance();
        BigDecimal getCurrentBalance();
    }
}
