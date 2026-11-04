package br.com.monviflow.transaction;

import java.util.List;
import java.util.Optional;
import java.math.BigDecimal;
import java.time.LocalDate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.Query;

public interface TransactionRepository extends JpaRepository<Transaction, Long>, JpaSpecificationExecutor<Transaction> {
    @EntityGraph(attributePaths = {"account", "category"})
    List<Transaction> findAllByUserIdOrderByDateDescIdDesc(Long userId);

    Optional<Transaction> findByIdAndUserId(Long id, Long userId);

    @Override
    @EntityGraph(attributePaths = {"account", "category"})
    Page<Transaction> findAll(Specification<Transaction> specification, Pageable pageable);

    @Query(value = """
            SELECT t.date AS day, COUNT(*) AS count,
                   SUM(CASE WHEN c.type = 'INCOME' THEN t.amount ELSE 0 END) AS income,
                   SUM(CASE WHEN c.type = 'EXPENSE' THEN t.amount ELSE 0 END) AS expense
            FROM financial_transaction t JOIN category c ON c.id = t.category_id
            WHERE t.user_id = :userId AND t.date >= :from AND t.date < :until
            GROUP BY t.date ORDER BY t.date
            """, nativeQuery = true)
    List<DailyTotal> dailyTotals(Long userId, LocalDate from, LocalDate until);

    @Query(value = """
            SELECT c.id, c.name, SUM(t.amount) AS amount
            FROM financial_transaction t JOIN category c ON c.id = t.category_id
            WHERE t.user_id = :userId AND t.date >= :from AND t.date < :until AND c.type = 'EXPENSE'
            GROUP BY c.id ORDER BY amount DESC, c.id
            """, nativeQuery = true)
    List<CategoryTotal> expenseTotals(Long userId, LocalDate from, LocalDate until);

    interface DailyTotal {
        LocalDate getDay();
        Long getCount();
        BigDecimal getIncome();
        BigDecimal getExpense();
    }

    interface CategoryTotal {
        Long getId();
        String getName();
        BigDecimal getAmount();
    }
}
