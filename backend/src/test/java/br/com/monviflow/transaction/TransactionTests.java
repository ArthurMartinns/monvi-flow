package br.com.monviflow.transaction;

import br.com.monviflow.PostgresIntegrationTest;
import br.com.monviflow.account.Account;
import br.com.monviflow.account.AccountRepository;
import br.com.monviflow.category.Category;
import br.com.monviflow.category.CategoryRepository;
import br.com.monviflow.category.CategoryType;
import br.com.monviflow.user.User;
import br.com.monviflow.user.UserRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class TransactionTests extends PostgresIntegrationTest {

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
    private JdbcTemplate jdbc;

    private Long ownerId;
    private Account account;
    private Category income;
    private Category expense;

    @BeforeEach
    void setup() {
        transactions.deleteAll();
        categories.deleteAll();
        accounts.deleteAll();
        users.deleteAll();
        ownerId = users.save(new User("Arthur", "arthur@example.com", "unused")).getId();
        users.save(new User("Maria", "maria@example.com", "unused"));
        account = accounts.save(new Account(ownerId, "Carteira", new BigDecimal("-125.90")));
        income = categories.save(new Category(ownerId, "Salario", CategoryType.INCOME));
        expense = categories.save(new Category(ownerId, "Alimentacao", CategoryType.EXPENSE));
    }

    @Test
    void shouldCreateIncomeAndExpenseAndCalculateBalance() throws Exception {
        for (Category category : new Category[] {income, expense}) {
            String amount = category == income ? "200.00" : "25.15";
            mvc.perform(post("/api/transactions").with(user("arthur@example.com")).with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(body(account.getId(), category.getId(), amount, "2026-01-02")))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.id").isNumber())
                    .andExpect(jsonPath("$.accountId").value(account.getId()))
                    .andExpect(jsonPath("$.accountName").value("Carteira"))
                    .andExpect(jsonPath("$.categoryName").value(category.getName()))
                    .andExpect(jsonPath("$.type").value(category.getType().name()))
                    .andExpect(jsonPath("$.description").value("Lancamento"))
                    .andExpect(jsonPath("$.amount").value(amount))
                    .andExpect(jsonPath("$.date").value("2026-01-02"))
                    .andExpect(jsonPath("$.userId").doesNotExist());
        }
        accounts.save(new Account(ownerId, "Outra conta", new BigDecimal("10.00")));
        mvc.perform(get("/api/accounts").with(user("arthur@example.com")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].initialBalance").value("-125.90"))
                .andExpect(jsonPath("$[0].currentBalance").value("48.95"))
                .andExpect(jsonPath("$[1].currentBalance").value("10.00"));
        assertEquals(new BigDecimal("-125.90"), accounts.findById(account.getId()).orElseThrow().getInitialBalance());
    }

    @Test
    void shouldListOnlyOwnTransactionsInDateOrder() throws Exception {
        Transaction older = save(income, "1.00", "2026-01-01");
        Transaction newer = save(expense, "2.00", "2026-01-03");
        Transaction sameDate = save(income, "3.00", "2026-01-03");
        mvc.perform(get("/api/transactions").with(user("arthur@example.com")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[0].id").value(sameDate.getId()))
                .andExpect(jsonPath("$[1].id").value(newer.getId()))
                .andExpect(jsonPath("$[2].id").value(older.getId()));
        mvc.perform(get("/api/transactions").param("userId", ownerId.toString())
                .with(user("maria@example.com")))
                .andExpect(status().isOk()).andExpect(content().json("[]"));
    }

    @Test
    void shouldRejectForeignOrMissingAccountAndCategory() throws Exception {
        Long mariaId = users.findByEmail("maria@example.com").orElseThrow().getId();
        Account foreignAccount = accounts.save(new Account(mariaId, "Outra", BigDecimal.ZERO));
        Category foreignCategory = categories.save(new Category(mariaId, "Outra", CategoryType.INCOME));
        for (Long id : new Long[] {foreignAccount.getId(), Long.MAX_VALUE}) {
            mvc.perform(post("/api/transactions").with(user("arthur@example.com")).with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(body(id, income.getId(), "10.00", "2026-01-01")))
                    .andExpect(status().isNotFound());
        }
        for (Long id : new Long[] {foreignCategory.getId(), Long.MAX_VALUE}) {
            mvc.perform(post("/api/transactions").with(user("arthur@example.com")).with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(body(account.getId(), id, "10.00", "2026-01-01")))
                    .andExpect(status().isNotFound());
        }
        assertEquals(0, transactions.count());
    }

    @Test
    void shouldValidateFields() throws Exception {
        String valid = body(account.getId(), expense.getId(), "10.00", "2026-01-01");
        for (String amount : new String[] {"0", "-1", "0.001", "100000000000000000.00", "abc"}) {
            mvc.perform(post("/api/transactions").with(user("arthur@example.com")).with(csrf())
                    .contentType(MediaType.APPLICATION_JSON).content(valid.replace("10.00", amount)))
                    .andExpect(status().isBadRequest());
        }
        for (String body : new String[] {"{}", valid.replace(" Lancamento ", " "),
                valid.replace(" Lancamento ", "a".repeat(256)),
                valid.replace("2026-01-01", LocalDate.now().plusDays(1).toString()),
                valid.replace("2026-01-01", "2026-02-30"),
                valid.replace("\"10.00\"", "null"),
                valid.replace("\"2026-01-01\"", "null")}) {
            mvc.perform(post("/api/transactions").with(user("arthur@example.com")).with(csrf())
                    .contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isBadRequest());
        }
        assertEquals(0, transactions.count());
    }

    @Test
    void shouldRequireAuthenticationAndCsrf() throws Exception {
        mvc.perform(get("/api/transactions")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/transactions").with(csrf()))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/transactions").with(user("arthur@example.com")))
                .andExpect(status().isForbidden());
        assertEquals(0, transactions.count());
    }

    @Test
    void shouldUseAuthenticatedOwnerAndCategoryType() throws Exception {
        Long mariaId = users.findByEmail("maria@example.com").orElseThrow().getId();
        String body = body(account.getId(), income.getId(), "10.00", "2026-01-01")
                .replace("}", ",\"userId\":" + mariaId + ",\"type\":\"EXPENSE\"}");
        mvc.perform(post("/api/transactions").with(user("arthur@example.com")).with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.type").value("INCOME"));
        mvc.perform(get("/api/transactions").with(user("maria@example.com")))
                .andExpect(status().isOk()).andExpect(content().json("[]"));
        mvc.perform(get("/api/transactions").with(user("arthur@example.com")))
                .andExpect(jsonPath("$.length()").value(1));
    }

    @Test
    void shouldProtectLinkedAccountAndCategoryAndKeepBalanceOnRename() throws Exception {
        save(expense, "0.10", "2026-01-01");
        mvc.perform(delete("/api/accounts/{id}", account.getId())
                .with(user("arthur@example.com")).with(csrf()))
                .andExpect(status().isConflict());
        mvc.perform(delete("/api/categories/{id}", expense.getId())
                .with(user("arthur@example.com")).with(csrf()))
                .andExpect(status().isConflict());
        mvc.perform(patch("/api/accounts/{id}", account.getId())
                .with(user("arthur@example.com")).with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Conta nova\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currentBalance").value("-126.00"));
        assertEquals(1, transactions.count());
    }

    @Test
    void shouldKeepPrecisionForLargeBalances() throws Exception {
        save(income, "99999999999999999.99", "2026-01-01");
        save(income, "99999999999999999.99", "2026-01-01");
        mvc.perform(get("/api/accounts").with(user("arthur@example.com")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].currentBalance").value("199999999999999874.08"));
    }

    @Test
    void shouldEnforceOwnershipInDatabase() {
        Long mariaId = users.findByEmail("maria@example.com").orElseThrow().getId();
        assertThrows(DataIntegrityViolationException.class, () -> jdbc.update("""
                INSERT INTO financial_transaction (user_id, account_id, category_id, description, amount, date)
                VALUES (?, ?, ?, 'Teste', 10, CURRENT_DATE)
                """, mariaId, account.getId(), expense.getId()));
        Category foreignCategory = categories.save(new Category(mariaId, "Outra", CategoryType.EXPENSE));
        assertThrows(DataIntegrityViolationException.class, () -> jdbc.update("""
                INSERT INTO financial_transaction (user_id, account_id, category_id, description, amount, date)
                VALUES (?, ?, ?, 'Teste', 10, CURRENT_DATE)
                """, ownerId, account.getId(), foreignCategory.getId()));
        assertEquals(0, transactions.count());
    }

    private Transaction save(Category category, String amount, String date) {
        var request = new CreateTransactionRequest(account.getId(), category.getId(),
                "Lancamento", new BigDecimal(amount), LocalDate.parse(date));
        return transactions.save(new Transaction(ownerId, account, category, request));
    }

    private String body(Long accountId, Long categoryId, String amount, String date) {
        return """
                {"accountId":%d,"categoryId":%d,"description":" Lancamento ","amount":"%s","date":"%s"}
                """.formatted(accountId, categoryId, amount, date);
    }
}
