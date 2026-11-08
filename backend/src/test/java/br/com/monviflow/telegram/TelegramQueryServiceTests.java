package br.com.monviflow.telegram;

import br.com.monviflow.PostgresIntegrationTest;
import br.com.monviflow.account.Account;
import br.com.monviflow.account.AccountRepository;
import br.com.monviflow.category.Category;
import br.com.monviflow.category.CategoryRepository;
import br.com.monviflow.category.CategoryType;
import br.com.monviflow.transaction.CreateTransactionRequest;
import br.com.monviflow.transaction.TransactionService;
import br.com.monviflow.user.User;
import br.com.monviflow.user.UserRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class TelegramQueryServiceTests extends PostgresIntegrationTest {
    @Autowired TelegramQueryService queries;
    @Autowired TransactionService transactions;
    @Autowired AccountRepository accounts;
    @Autowired CategoryRepository categories;
    @Autowired UserRepository users;

    @Test
    void recentAndSummaryAreScopedToUserAndMonth() {
        var user = users.save(new User("Telegram query", "telegram-query@example.com", "unused"));
        var other = users.save(new User("Other query", "other-query@example.com", "unused"));
        var account = accounts.save(new Account(user.getId(), "Carteira", BigDecimal.ZERO));
        var otherAccount = accounts.save(new Account(other.getId(), "Outra", BigDecimal.ZERO));
        var expense = categories.save(new Category(user.getId(), "Lazer", CategoryType.EXPENSE));
        var income = categories.save(new Category(user.getId(), "Salário", CategoryType.INCOME));
        var otherExpense = categories.save(new Category(other.getId(), "Lazer", CategoryType.EXPENSE));

        transactions.createForUser(user.getId(), new CreateTransactionRequest(account.getId(), expense.getId(),
                "Cinema", new BigDecimal("25.90"), LocalDate.of(2026, 11, 7)));
        transactions.createForUser(user.getId(), new CreateTransactionRequest(account.getId(), income.getId(),
                "Pagamento", new BigDecimal("100.00"), LocalDate.of(2026, 11, 8)));
        transactions.createForUser(user.getId(), new CreateTransactionRequest(account.getId(), expense.getId(),
                "Mês passado", new BigDecimal("10.00"), LocalDate.of(2026, 10, 20)));
        transactions.createForUser(other.getId(), new CreateTransactionRequest(otherAccount.getId(), otherExpense.getId(),
                "Segredo", new BigDecimal("50.00"), LocalDate.of(2026, 11, 8)));

        var recent = queries.recent(user.getId());
        assertTrue(recent.indexOf("Pagamento") < recent.indexOf("Cinema"));
        assertTrue(recent.contains("Mês passado"));
        assertFalse(recent.contains("Segredo"));
        var summary = queries.summary(user.getId(), YearMonth.of(2026, 11));
        assertTrue(summary.contains("100,00"));
        assertTrue(summary.contains("25,90"));
        assertTrue(summary.contains("74,10"));
        assertFalse(summary.contains("50,00"));
    }
}
