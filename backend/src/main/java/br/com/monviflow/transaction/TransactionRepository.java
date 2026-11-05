package br.com.monviflow.transaction;

import java.util.List;
import java.util.Optional;
import java.math.BigDecimal;
import java.time.LocalDate;
import org.jspecify.annotations.NullMarked;
import org.jspecify.annotations.Nullable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.Query;

@NullMarked
public interface TransactionRepository extends JpaRepository<Transaction, Long>, JpaSpecificationExecutor<Transaction> {
  @EntityGraph(attributePaths = { "account", "category" })
  List<Transaction> findAllByUserIdOrderByDateDescIdDesc(Long userId);

  Optional<Transaction> findByIdAndUserId(Long id, Long userId);

  @Override
  @EntityGraph(attributePaths = { "account", "category" })
  Page<Transaction> findAll(Specification<Transaction> specification, Pageable pageable);

  @Override
  @EntityGraph(attributePaths = { "account", "category" })
  List<Transaction> findAll(Specification<Transaction> specification, Sort sort);

  @Query(value = """
      SELECT t.date AS day, COUNT(*) AS count,
             SUM(CASE WHEN c.type = 'INCOME' THEN t.amount ELSE 0 END) AS income,
             SUM(CASE WHEN c.type = 'EXPENSE' THEN t.amount ELSE 0 END) AS expense
      FROM financial_transaction t JOIN category c ON c.id = t.category_id
      WHERE t.user_id = :userId AND t.date >= :from AND t.date < :until
        AND (CAST(:accountId AS bigint) IS NULL OR t.account_id = :accountId)
      GROUP BY t.date ORDER BY t.date
      """, nativeQuery = true)
  List<DailyTotal> dailyTotals(Long userId, LocalDate from, LocalDate until, @Nullable Long accountId);

  @Query(value = """
      SELECT c.id, c.name, SUM(t.amount) AS amount
      FROM financial_transaction t JOIN category c ON c.id = t.category_id
      WHERE t.user_id = :userId AND t.date >= :from AND t.date < :until AND c.type = 'EXPENSE'
        AND (CAST(:accountId AS bigint) IS NULL OR t.account_id = :accountId)
      GROUP BY c.id ORDER BY amount DESC, c.id
      """, nativeQuery = true)
  List<CategoryTotal> expenseTotals(Long userId, LocalDate from, LocalDate until, @Nullable Long accountId);

  @Query(value = """
      SELECT CAST(date_trunc('month', t.date) AS date) AS month,
             SUM(CASE WHEN c.type = 'INCOME' THEN t.amount ELSE 0 END) AS income,
             SUM(CASE WHEN c.type = 'EXPENSE' THEN t.amount ELSE 0 END) AS expense
      FROM financial_transaction t JOIN category c ON c.id = t.category_id
      WHERE t.user_id = :userId AND t.date >= :from AND t.date < :until
        AND (CAST(:accountId AS bigint) IS NULL OR t.account_id = :accountId)
      GROUP BY date_trunc('month', t.date) ORDER BY month
      """, nativeQuery = true)
  List<MonthlyTotal> monthlyTotals(Long userId, LocalDate from, LocalDate until, @Nullable Long accountId);

  @EntityGraph(attributePaths = { "account", "category" })
  @Query("""
      SELECT t FROM Transaction t WHERE t.userId = :userId AND t.date >= :from AND t.date < :until
          AND (:accountId IS NULL OR t.account.id = :accountId)
      ORDER BY t.date DESC, t.id DESC
      """)
  List<Transaction> recent(Long userId, LocalDate from, LocalDate until, @Nullable Long accountId, Pageable pageable);

  interface MonthlyTotal {
    LocalDate getMonth();

    BigDecimal getIncome();

    BigDecimal getExpense();
  }

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
