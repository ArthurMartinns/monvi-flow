package br.com.monviflow.overview;

import br.com.monviflow.PostgresIntegrationTest;
import br.com.monviflow.account.*;
import br.com.monviflow.budget.*;
import br.com.monviflow.category.*;
import br.com.monviflow.transaction.*;
import br.com.monviflow.user.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class OverviewTests extends PostgresIntegrationTest {
        @Autowired
        private MockMvc mvc;
        @Autowired
        private TransactionRepository transactions;
        @Autowired
        private AccountRepository accounts;
        @Autowired
        private CategoryRepository categories;
        @Autowired
        private UserRepository users;
        @Autowired
        private BudgetRepository budgets;
        @Autowired
        private BudgetService budgetService;
        @Autowired
        private TransactionService transactionService;
        private Long owner;
        private Account account;
        private Account bank;
        private Category income;
        private Category food;
        private Category transport;

        @BeforeEach
        void setup() {
                budgets.deleteAll();
                transactions.deleteAll();
                categories.deleteAll();
                accounts.deleteAll();
                users.deleteAll();
                owner = users.save(new User("Arthur", "arthur@example.com", "unused")).getId();
                users.save(new User("Maria", "maria@example.com", "unused"));
                account = accounts.save(new Account(owner, "Carteira", new BigDecimal("100.00")));
                bank = accounts.save(new Account(owner, "Banco", new BigDecimal("25.00")));
                income = categories.save(new Category(owner, "Salario", CategoryType.INCOME));
                food = categories.save(new Category(owner, "Alimentacao", CategoryType.EXPENSE));
                transport = categories.save(new Category(owner, "Transporte", CategoryType.EXPENSE));
        }

        @Test
        void shouldSeparateCurrentBalanceFromMonthlyResultAndGroupExpenses() throws Exception {
                save(owner, account, income, "200.10", "2026-02-01", "Salario");
                save(owner, account, food, "20.00", "2026-02-15", "Mercado");
                save(owner, account, transport, "30.05", "2026-02-28", "Onibus");
                save(owner, account, income, "10.00", "2026-01-31", "Anterior");
                save(owner, account, income, "5.00", "2026-03-01", "Posterior");
                Long maria = users.findByEmail("maria@example.com").orElseThrow().getId();
                var foreignAccount = accounts.save(new Account(maria, "Outra", BigDecimal.ZERO));
                var foreignCategory = categories.save(new Category(maria, "Outra", CategoryType.INCOME));
                save(maria, foreignAccount, foreignCategory, "999.00", "2026-02-01", "Outro usuario");
                mvc.perform(get("/api/overview").param("month", "2026-02").with(user("arthur@example.com")))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.totalBalance").value("290.05"))
                                .andExpect(jsonPath("$.accountCount").value(2))
                                .andExpect(jsonPath("$.income").value("200.10"))
                                .andExpect(jsonPath("$.expense").value("50.05"))
                                .andExpect(jsonPath("$.result").value("150.05"))
                                .andExpect(jsonPath("$.transactionCount").value(3))
                                .andExpect(jsonPath("$.days.length()").value(3))
                                .andExpect(jsonPath("$.days[0].date").value("2026-02-01"))
                                .andExpect(jsonPath("$.days[2].expense").value("30.05"))
                                .andExpect(jsonPath("$.categories.length()").value(2))
                                .andExpect(jsonPath("$.categories[0].name").value("Transporte"))
                                .andExpect(jsonPath("$.categories[0].amount").value("30.05"));
        }

        @Test
        void shouldReturnEmptyMonthAndEmptyUser() throws Exception {
                mvc.perform(get("/api/overview").param("month", "2026-02").with(user("arthur@example.com")))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.totalBalance").value("125.00"))
                                .andExpect(jsonPath("$.income").value("0.00"))
                                .andExpect(jsonPath("$.expense").value("0.00"))
                                .andExpect(jsonPath("$.result").value("0.00"))
                                .andExpect(jsonPath("$.transactionCount").value(0))
                                .andExpect(jsonPath("$.days").isEmpty())
                                .andExpect(jsonPath("$.categories").isEmpty());
                mvc.perform(get("/api/overview").param("month", "2026-02").with(user("maria@example.com")))
                                .andExpect(jsonPath("$.totalBalance").value("0.00"))
                                .andExpect(jsonPath("$.accountCount").value(0));
        }

        @Test
        void shouldPreserveLargeAmountsAndNegativeMonthlyResult() throws Exception {
                save(owner, account, food, "99999999999999999.99", "2026-02-01", "Despesa 1");
                save(owner, account, food, "99999999999999999.99", "2026-02-02", "Despesa 2");
                mvc.perform(get("/api/overview").param("month", "2026-02").with(user("arthur@example.com")))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.expense").value("199999999999999999.98"))
                                .andExpect(jsonPath("$.result").value("-199999999999999999.98"))
                                .andExpect(jsonPath("$.totalBalance").value("-199999999999999874.98"));
        }

        @Test
        void shouldFilterByDatesAccountCategoryTypeAndDescription() throws Exception {
                save(owner, account, food, "20.00", "2026-02-15", "MeRcAdO semanal");
                save(owner, account, income, "50.00", "2026-02-15", "Mercado reembolso");
                save(owner, account, food, "10.00", "2026-01-15", "Mercado antigo");
                mvc.perform(get("/api/transactions/search").with(user("arthur@example.com"))
                                .param("from", "2026-02-15").param("to", "2026-02-15")
                                .param("accountId", account.getId().toString())
                                .param("categoryId", food.getId().toString())
                                .param("type", "EXPENSE").param("query", "mercado"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.totalElements").value(1))
                                .andExpect(jsonPath("$.content[0].description").value("MeRcAdO semanal"));
        }

        @Test
        void shouldPaginateInStableOrderWithoutExposingOtherUsers() throws Exception {
                for (int index = 0; index < 12; index++)
                        save(owner, account, food, "1.00", "2026-02-15", "Item " + index);
                mvc.perform(get("/api/transactions/search").with(user("arthur@example.com"))
                                .param("page", "1").param("size", "5"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.totalElements").value(12))
                                .andExpect(jsonPath("$.totalPages").value(3))
                                .andExpect(jsonPath("$.content.length()").value(5))
                                .andExpect(jsonPath("$.content[0].description").value("Item 6"))
                                .andExpect(jsonPath("$.content[4].description").value("Item 2"));
                mvc.perform(get("/api/transactions/search").with(user("arthur@example.com"))
                                .param("page", "2").param("size", "5"))
                                .andExpect(jsonPath("$.content.length()").value(2));
                mvc.perform(get("/api/transactions/search").with(user("maria@example.com"))
                                .param("accountId", account.getId().toString()).param("userId", owner.toString()))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.totalElements").value(0))
                                .andExpect(jsonPath("$.content").isEmpty());
        }

        @Test
        void shouldTreatSearchWildcardsAsLiteralText() throws Exception {
                save(owner, account, food, "1.00", "2026-02-01", "Taxa 10%_extra");
                save(owner, account, food, "1.00", "2026-02-01", "Taxa 100 extra");
                mvc.perform(get("/api/transactions/search").with(user("arthur@example.com")).param("query", "%_"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.totalElements").value(1))
                                .andExpect(jsonPath("$.content[0].description").value("Taxa 10%_extra"));
        }

        @Test
        void shouldValidateFiltersMonthAndAuthentication() throws Exception {
                for (String[] param : new String[][] { { "page", "-1" }, { "size", "0" }, { "size", "101" },
                                { "accountId", "0" }, { "categoryId", "-1" }, { "type", "OTHER" },
                                { "from", "invalid" }, { "query", "a".repeat(101) } }) {
                        mvc.perform(get("/api/transactions/search").with(user("arthur@example.com")).param(param[0],
                                        param[1]))
                                        .andExpect(status().isBadRequest());
                }
                mvc.perform(get("/api/transactions/search").with(user("arthur@example.com"))
                                .param("from", "2026-03-01").param("to", "2026-02-01"))
                                .andExpect(status().isBadRequest());
                for (String month : new String[] { "2026-13", "invalid", "0000-01" }) {
                        mvc.perform(get("/api/overview").with(user("arthur@example.com")).param("month", month))
                                        .andExpect(status().isBadRequest());
                }
                mvc.perform(get("/api/overview").with(user("arthur@example.com"))).andExpect(status().isBadRequest());
                mvc.perform(get("/api/overview").param("month", "2026-02")).andExpect(status().isUnauthorized());
                mvc.perform(get("/api/transactions/search")).andExpect(status().isUnauthorized());
        }

        @Test
        void shouldFilterMonthlyTotalsAndCurrentBalanceByAccount() throws Exception {
                save(owner, account, income, "200.10", "2026-02-01", "Salario");
                save(owner, account, food, "20.00", "2026-02-15", "Mercado");
                save(owner, account, transport, "30.05", "2026-02-28", "Onibus");
                save(owner, account, income, "10.00", "2026-01-31", "Anterior");
                save(owner, account, income, "5.00", "2026-03-01", "Posterior");
                save(owner, bank, income, "1000.00", "2026-02-01", "Outra conta");
                save(owner, bank, food, "40.00", "2026-02-15", "Outra compra");
                mvc.perform(get("/api/overview").param("month", "2026-02")
                                .param("accountId", account.getId().toString()).with(user("arthur@example.com")))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.totalBalance").value("265.05"))
                                .andExpect(jsonPath("$.accountCount").value(1))
                                .andExpect(jsonPath("$.income").value("200.10"))
                                .andExpect(jsonPath("$.expense").value("50.05"))
                                .andExpect(jsonPath("$.result").value("150.05"))
                                .andExpect(jsonPath("$.transactionCount").value(3))
                                .andExpect(jsonPath("$.days.length()").value(3))
                                .andExpect(jsonPath("$.days[0].income").value("200.10"))
                                .andExpect(jsonPath("$.categories.length()").value(2))
                                .andExpect(jsonPath("$.categories[0].amount").value("30.05"))
                                .andExpect(jsonPath("$.categories[1].amount").value("20.00"));
                mvc.perform(get("/api/overview").param("month", "2026-02").with(user("arthur@example.com")))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.totalBalance").value("1250.05"))
                                .andExpect(jsonPath("$.accountCount").value(2))
                                .andExpect(jsonPath("$.income").value("1200.10"))
                                .andExpect(jsonPath("$.expense").value("90.05"));
        }

        @Test
        void shouldKeepAccountBalanceWhenSelectedMonthIsEmpty() throws Exception {
                save(owner, bank, food, "50.00", "2026-01-01", "Mes anterior");
                mvc.perform(get("/api/overview").param("month", "2026-02")
                                .param("accountId", bank.getId().toString()).with(user("arthur@example.com")))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.totalBalance").value("-25.00"))
                                .andExpect(jsonPath("$.accountCount").value(1))
                                .andExpect(jsonPath("$.income").value("0.00"))
                                .andExpect(jsonPath("$.expense").value("0.00"))
                                .andExpect(jsonPath("$.result").value("0.00"))
                                .andExpect(jsonPath("$.transactionCount").value(0))
                                .andExpect(jsonPath("$.days").isEmpty())
                                .andExpect(jsonPath("$.categories").isEmpty());
        }

        @Test
        void shouldRejectUnknownForeignAndInvalidAccounts() throws Exception {
                for (String id : new String[] { account.getId().toString(), "9223372036854775807" }) {
                        mvc.perform(get("/api/overview").param("month", "2026-02").param("accountId", id)
                                        .param("userId", owner.toString()).with(user("maria@example.com")))
                                        .andExpect(status().isNotFound());
                }
                for (String id : new String[] { "0", "-1", "abc", "9223372036854775808" }) {
                        mvc.perform(get("/api/overview").param("month", "2026-02").param("accountId", id)
                                        .with(user("arthur@example.com"))).andExpect(status().isBadRequest());
                }
        }

        @Test
        void shouldKeepBudgetsGlobalWhenFilteringAnAccount() throws Exception {
                save(owner, account, food, "20.00", "2026-02-01", "Carteira");
                save(owner, bank, food, "40.00", "2026-02-01", "Banco");
                budgetService.save("arthur@example.com", food.getId(),
                                new BudgetRequest(YearMonth.of(2026, 2), new BigDecimal("100.00")));
                mvc.perform(get("/api/overview").param("month", "2026-02")
                                .param("accountId", account.getId().toString()).with(user("arthur@example.com")))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.expense").value("20.00"))
                                .andExpect(jsonPath("$.budgets[0].spent").value("60.00"))
                                .andExpect(jsonPath("$.budgets[0].remaining").value("40.00"));
        }

        @Test
        void shouldCompareSixMonthsWithZerosAndExactAmounts() throws Exception {
                save(owner, account, income, "100.10", "2025-09-01", "Primeiro mes");
                save(owner, account, food, "99999999999999999.99", "2025-12-31", "Dezembro");
                save(owner, account, food, "0.01", "2025-12-01", "Centavo");
                save(owner, account, income, "12.34", "2026-02-28", "Mes escolhido");
                save(owner, bank, income, "50.00", "2026-02-01", "Outra conta");
                save(owner, account, income, "999.00", "2025-08-31", "Antes da janela");
                save(owner, account, income, "999.00", "2026-03-01", "Depois da janela");
                mvc.perform(get("/api/overview").param("month", "2026-02")
                                .param("accountId", account.getId().toString()).with(user("arthur@example.com")))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.months.length()").value(6))
                                .andExpect(jsonPath("$.months[0].month").value("2025-09"))
                                .andExpect(jsonPath("$.months[0].income").value("100.10"))
                                .andExpect(jsonPath("$.months[1].month").value("2025-10"))
                                .andExpect(jsonPath("$.months[1].income").value("0.00"))
                                .andExpect(jsonPath("$.months[1].expense").value("0.00"))
                                .andExpect(jsonPath("$.months[3].expense").value("100000000000000000.00"))
                                .andExpect(jsonPath("$.months[3].result").value("-100000000000000000.00"))
                                .andExpect(jsonPath("$.months[5].month").value("2026-02"))
                                .andExpect(jsonPath("$.months[5].income").value("12.34"));
                mvc.perform(get("/api/overview").param("month", "2026-02").with(user("arthur@example.com")))
                                .andExpect(jsonPath("$.months[5].income").value("62.34"));
                mvc.perform(get("/api/overview").param("month", "2026-02").with(user("maria@example.com")))
                                .andExpect(jsonPath("$.months[0].income").value("0.00"))
                                .andExpect(jsonPath("$.months[3].expense").value("0.00"))
                                .andExpect(jsonPath("$.months[5].income").value("0.00"));
        }

        @Test
        void shouldReturnOnlyFiveRecentTransactionsInStableOrder() throws Exception {
                for (int index = 0; index < 8; index++)
                        save(owner, account, food, "1.00", "2026-02-15", "Item " + index);
                save(owner, account, food, "2.00", "2026-02-01", "Mais antiga");
                save(owner, account, food, "2.00", "2026-03-01", "Outro mes");
                save(owner, bank, income, "5.00", "2026-02-28", "Outra conta");
                mvc.perform(get("/api/overview").param("month", "2026-02")
                                .param("accountId", account.getId().toString()).with(user("arthur@example.com")))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.recentTransactions.length()").value(5))
                                .andExpect(jsonPath("$.recentTransactions[0].description").value("Item 7"))
                                .andExpect(jsonPath("$.recentTransactions[4].description").value("Item 3"))
                                .andExpect(jsonPath("$.recentTransactions[0].accountName").value("Carteira"))
                                .andExpect(jsonPath("$.recentTransactions[0].categoryName").value("Alimentacao"));
                mvc.perform(get("/api/overview").param("month", "2026-02").with(user("arthur@example.com")))
                                .andExpect(jsonPath("$.recentTransactions[0].description").value("Outra conta"));
                mvc.perform(get("/api/overview").param("month", "2026-02").with(user("maria@example.com")))
                                .andExpect(jsonPath("$.recentTransactions").isEmpty());
        }

        @Test
        void shouldRefreshHistoryAndRecentTransactionsAfterChanges() throws Exception {
                var transaction = save(owner, account, food, "10.00", "2026-02-15", "Original");
                transactionService.update("arthur@example.com", transaction.getId(),
                                new CreateTransactionRequest(bank.getId(), income.getId(), "Alterado",
                                                new BigDecimal("25.90"), LocalDate.of(2026, 3, 1)));
                mvc.perform(get("/api/overview").param("month", "2026-02").with(user("arthur@example.com")))
                                .andExpect(jsonPath("$.months[5].expense").value("0.00"))
                                .andExpect(jsonPath("$.recentTransactions").isEmpty());
                mvc.perform(get("/api/overview").param("month", "2026-03")
                                .param("accountId", bank.getId().toString()).with(user("arthur@example.com")))
                                .andExpect(jsonPath("$.months[5].income").value("25.90"))
                                .andExpect(jsonPath("$.recentTransactions[0].description").value("Alterado"));
                transactionService.delete("arthur@example.com", transaction.getId());
                mvc.perform(get("/api/overview").param("month", "2026-03").with(user("arthur@example.com")))
                                .andExpect(jsonPath("$.months[5].income").value("0.00"))
                                .andExpect(jsonPath("$.recentTransactions").isEmpty());
        }

        @Test
        void shouldHandleEmptyHistoryAndCalendarLimits() throws Exception {
                for (String month : new String[] { "0001-01", "9999-12", "2026-02" }) {
                        mvc.perform(get("/api/overview").param("month", month).with(user("arthur@example.com")))
                                        .andExpect(status().isOk())
                                        .andExpect(jsonPath("$.months.length()").value(month.equals("0001-01") ? 1 : 6))
                                        .andExpect(jsonPath("$.months[0].income").value("0.00"))
                                        .andExpect(jsonPath("$.months[0].result").value("0.00"))
                                        .andExpect(jsonPath("$.recentTransactions").isEmpty());
                }
        }

        private Transaction save(Long userId, Account account, Category category, String amount, String date,
                        String description) {
                var request = new CreateTransactionRequest(account.getId(), category.getId(), description,
                                new BigDecimal(amount), LocalDate.parse(date));
                return transactions.save(new Transaction(userId, account, category, request));
        }
}
