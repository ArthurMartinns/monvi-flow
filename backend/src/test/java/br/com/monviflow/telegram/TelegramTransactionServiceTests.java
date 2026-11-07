package br.com.monviflow.telegram;

import br.com.monviflow.PostgresIntegrationTest;
import br.com.monviflow.account.Account;
import br.com.monviflow.account.AccountRepository;
import br.com.monviflow.category.Category;
import br.com.monviflow.category.CategoryRepository;
import br.com.monviflow.category.CategoryType;
import br.com.monviflow.transaction.CreateTransactionRequest;
import br.com.monviflow.transaction.TransactionRepository;
import br.com.monviflow.user.User;
import br.com.monviflow.user.UserRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.server.ResponseStatusException;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class TelegramTransactionServiceTests extends PostgresIntegrationTest {
    @Autowired TelegramTransactionService telegramTransactions;
    @Autowired TransactionRepository transactions;
    @Autowired AccountRepository accounts;
    @Autowired CategoryRepository categories;
    @Autowired UserRepository users;
    @Autowired JdbcTemplate jdbc;

    @Test
    void sameUpdateCreatesOnlyOneTransaction() {
        var user = users.save(new User("Telegram", "telegram-idempotency@example.com", "unused"));
        var account = accounts.save(new Account(user.getId(), "Carteira", BigDecimal.ZERO));
        var category = categories.save(new Category(user.getId(), "Lazer", CategoryType.EXPENSE));
        var request = request(account.getId(), category.getId());

        var first = telegramTransactions.createOnce(123456L, user.getId(), request);
        var second = telegramTransactions.createOnce(123456L, user.getId(), request);
        var separateMessage = telegramTransactions.createOnce(123458L, user.getId(), request);

        assertTrue(first.isPresent());
        assertTrue(second.isEmpty());
        assertTrue(separateMessage.isPresent());
        assertEquals(2, transactions.count());
        assertEquals(1, jdbc.queryForObject(
                "SELECT count(*) FROM telegram_processed_transaction WHERE update_id = 123456", Integer.class));
    }

    @Test
    void failedCreationDoesNotConsumeUpdateId() {
        long countBefore = transactions.count();
        var user = users.save(new User("Telegram", "telegram-retry@example.com", "unused"));
        var account = accounts.save(new Account(user.getId(), "Carteira", BigDecimal.ZERO));
        var category = categories.save(new Category(user.getId(), "Lazer", CategoryType.EXPENSE));

        assertThrows(ResponseStatusException.class, () -> telegramTransactions.createOnce(
                123457L, user.getId(), request(Long.MAX_VALUE, category.getId())));
        assertEquals(0, jdbc.queryForObject(
                "SELECT count(*) FROM telegram_processed_transaction WHERE update_id = 123457", Integer.class));
        assertTrue(telegramTransactions.createOnce(
                123457L, user.getId(), request(account.getId(), category.getId())).isPresent());
        assertEquals(countBefore + 1, transactions.count());
    }

    private CreateTransactionRequest request(Long accountId, Long categoryId) {
        return new CreateTransactionRequest(accountId, categoryId, "Cinema", new BigDecimal("25.90"),
                LocalDate.of(2026, 11, 7));
    }
}
