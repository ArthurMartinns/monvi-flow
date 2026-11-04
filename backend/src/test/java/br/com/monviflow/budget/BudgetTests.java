package br.com.monviflow.budget;

import br.com.monviflow.PostgresIntegrationTest;
import br.com.monviflow.account.*;
import br.com.monviflow.category.*;
import br.com.monviflow.transaction.*;
import br.com.monviflow.user.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class BudgetTests extends PostgresIntegrationTest {
        @Autowired
        private MockMvc mvc;
        @Autowired
        private BudgetRepository budgets;
        @Autowired
        private TransactionRepository transactions;
        @Autowired
        private CategoryRepository categories;
        @Autowired
        private AccountRepository accounts;
        @Autowired
        private UserRepository users;
        private Long owner;
        private Account account;
        private Category expense;
        private Category income;

        @BeforeEach
        void setup() {
                budgets.deleteAll();
                transactions.deleteAll();
                categories.deleteAll();
                accounts.deleteAll();
                users.deleteAll();
                owner = users.save(new User("Arthur", "arthur@example.com", "unused")).getId();
                users.save(new User("Maria", "maria@example.com", "unused"));
                account = accounts.save(new Account(owner, "Carteira", BigDecimal.ZERO));
                expense = categories.save(new Category(owner, "Alimentacao", CategoryType.EXPENSE));
                income = categories.save(new Category(owner, "Salario", CategoryType.INCOME));
        }

        @Test
        void shouldCreateAndUpdateOneLimitPerMonthAndCategory() throws Exception {
                saveLimit("2026-02", "100.00");
                saveLimit("2026-02", "150.10");
                assertEquals(1, budgets.count());
                saveLimit("2026-03", "50.00");
                assertEquals(2, budgets.count());
                mvc.perform(get("/api/budgets").param("month", "2026-02").with(user("arthur@example.com")))
                                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1))
                                .andExpect(jsonPath("$[0].limitAmount").value("150.10"))
                                .andExpect(jsonPath("$[0].spent").value("0.00"))
                                .andExpect(jsonPath("$[0].remaining").value("150.10"));
                mvc.perform(get("/api/budgets").param("month", "2026-02").with(user("maria@example.com")))
                                .andExpect(content().json("[]"));
        }

        @Test
        void shouldSumAllAccountsOnlyWithinSelectedMonthAndIncludeInOverview() throws Exception {
                saveLimit("2026-02", "30.00");
                saveTransaction(account, "15.10", "2026-02-01", "Mercado");
                Account other = accounts.save(new Account(owner, "Banco", BigDecimal.ZERO));
                saveTransaction(other, "20.20", "2026-02-28", "Feira");
                saveTransaction(account, "99.00", "2026-01-31", "Anterior");
                saveTransaction(account, "99.00", "2026-03-01", "Posterior");
                mvc.perform(get("/api/budgets").param("month", "2026-02").with(user("arthur@example.com")))
                                .andExpect(jsonPath("$[0].spent").value("35.30"))
                                .andExpect(jsonPath("$[0].remaining").value("-5.30"));
                mvc.perform(get("/api/overview").param("month", "2026-02").with(user("arthur@example.com")))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.budgets[0].remaining").value("-5.30"));
        }

        @Test
        void shouldRecalculateAfterEditingAndDeletingTransaction() throws Exception {
                saveLimit("2026-02", "25.00");
                Transaction transaction = saveTransaction(account, "30.00", "2026-02-01", "Mercado");
                mvc.perform(put("/api/transactions/{id}", transaction.getId()).with(user("arthur@example.com"))
                                .with(csrf())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("""
                                                {"accountId":%d,"categoryId":%d,"description":"Mercado","amount":"5.00","date":"2026-02-01"}
                                                """
                                                .formatted(account.getId(), expense.getId())))
                                .andExpect(status().isOk());
                mvc.perform(get("/api/budgets").param("month", "2026-02").with(user("arthur@example.com")))
                                .andExpect(jsonPath("$[0].remaining").value("20.00"));
                mvc.perform(delete("/api/transactions/{id}", transaction.getId()).with(user("arthur@example.com"))
                                .with(csrf()))
                                .andExpect(status().isNoContent());
                mvc.perform(get("/api/budgets").param("month", "2026-02").with(user("arthur@example.com")))
                                .andExpect(jsonPath("$[0].remaining").value("25.00"));
        }

        @Test
        void shouldProtectOwnershipAndAllowOnlyExpenseCategories() throws Exception {
                saveLimit("2026-02", "10.00");
                Long id = budgets.findSummaries(owner,
                                LocalDate.parse("2026-02-01"), LocalDate.parse("2026-03-01")).getFirst().getId();
                mvc.perform(delete("/api/budgets/{id}", id).with(user("maria@example.com")).with(csrf()))
                                .andExpect(status().isNotFound());
                mvc.perform(put("/api/budgets/{id}", expense.getId()).with(user("maria@example.com")).with(csrf())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"month\":\"2026-02\",\"limitAmount\":\"1.00\"}"))
                                .andExpect(status().isNotFound());
                mvc.perform(put("/api/budgets/{id}", income.getId()).with(user("arthur@example.com")).with(csrf())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"month\":\"2026-02\",\"limitAmount\":\"1.00\"}"))
                                .andExpect(status().isBadRequest());
                assertEquals(1, budgets.count());
        }

        @Test
        void shouldRemoveOnlyBudgetAndPreserveTransactions() throws Exception {
                saveLimit("2026-02", "10.00");
                saveTransaction(account, "5.00", "2026-02-01", "Mercado");
                Long id = budgets.findSummaries(owner, LocalDate.parse("2026-02-01"), LocalDate.parse("2026-03-01"))
                                .getFirst().getId();
                mvc.perform(delete("/api/budgets/{id}", id).with(user("arthur@example.com")).with(csrf()))
                                .andExpect(status().isNoContent());
                assertEquals(0, budgets.count());
                assertEquals(1, transactions.count());
        }

        @Test
        void shouldValidateValuesMonthSessionAndCsrf() throws Exception {
                for (String amount : new String[] { "0", "-1", "1.001", "100000000000000000.00", "abc" }) {
                        mvc.perform(put("/api/budgets/{id}", expense.getId()).with(user("arthur@example.com"))
                                        .with(csrf())
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content("{\"month\":\"2026-02\",\"limitAmount\":\"" + amount + "\"}"))
                                        .andExpect(status().isBadRequest());
                }
                for (String body : new String[] { "{}", "{\"month\":\"2026-13\",\"limitAmount\":\"10\"}",
                                "{\"month\":\"0000-01\",\"limitAmount\":\"10\"}" }) {
                        mvc.perform(put("/api/budgets/{id}", expense.getId()).with(user("arthur@example.com"))
                                        .with(csrf())
                                        .contentType(MediaType.APPLICATION_JSON).content(body))
                                        .andExpect(status().isBadRequest());
                }
                mvc.perform(get("/api/budgets").param("month", "2026-02")).andExpect(status().isUnauthorized());
                mvc.perform(put("/api/budgets/{id}", expense.getId()).with(user("arthur@example.com")))
                                .andExpect(status().isForbidden());
                mvc.perform(delete("/api/budgets/1").with(user("arthur@example.com")))
                                .andExpect(status().isForbidden());
                assertEquals(0, budgets.count());
        }

        @Test
        void shouldExportAllFilteredRowsWithAccentsQuotesAndExactAmounts() throws Exception {
                for (int index = 0; index < 23; index++)
                        saveTransaction(account, "1250.90", "2026-02-01", "Mercado; \"café\" " + index);
                saveTransaction(account, "1.00", "2026-01-01", "Fora do periodo");
                String csv = mvc.perform(get("/api/transactions/export").with(user("arthur@example.com"))
                                .param("from", "2026-02-01").param("to", "2026-02-28").param("type", "EXPENSE")
                                .param("query", "mercado").param("page", "2").param("size", "5"))
                                .andExpect(status().isOk())
                                .andExpect(header().string("Content-Disposition",
                                                "attachment; filename=\"movimentacoes.csv\""))
                                .andReturn().getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
                assertTrue(csv.startsWith("\uFEFFData;"));
                assertEquals(24, csv.lines().count());
                assertTrue(csv.contains("\"1250,90\""));
                assertTrue(csv.contains("\"Mercado; \"\"café\"\" 22\""));
                assertFalse(csv.contains("Fora do periodo"));
                String foreign = mvc.perform(get("/api/transactions/export").with(user("maria@example.com")))
                                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
                assertEquals(1, foreign.lines().count());
                mvc.perform(get("/api/transactions/export")).andExpect(status().isUnauthorized());
        }

        @Test
        void shouldEscapeSpreadsheetFormulasAndPreserveLineBreaks() {
                var rows = java.util.List
                                .of(new TransactionResponse(1L, 1L, "@conta", 1L, "-categoria", CategoryType.EXPENSE,
                                                "=1+1\nsegunda linha", "0.10", LocalDate.parse("2026-02-01")));
                String csv = TransactionCsv.write(rows);
                assertTrue(csv.contains("\"'=1+1\nsegunda linha\""));
                assertTrue(csv.contains("\"'@conta\""));
                assertTrue(csv.contains("\"'-categoria\""));
        }

        private void saveLimit(String month, String amount) throws Exception {
                mvc.perform(put("/api/budgets/{id}", expense.getId()).with(user("arthur@example.com")).with(csrf())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"month\":\"" + month + "\",\"limitAmount\":\"" + amount + "\"}"))
                                .andExpect(status().isOk());
        }

        private Transaction saveTransaction(Account account, String amount, String date, String description) {
                return transactions.save(new Transaction(owner, account, expense,
                                new CreateTransactionRequest(account.getId(), expense.getId(), description,
                                                new BigDecimal(amount), LocalDate.parse(date))));
        }
}
