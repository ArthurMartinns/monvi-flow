package br.com.monviflow.account;

import br.com.monviflow.PostgresIntegrationTest;
import br.com.monviflow.user.User;
import br.com.monviflow.user.UserRepository;
import java.math.BigDecimal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class AccountTests extends PostgresIntegrationTest {

    @Autowired
    private MockMvc mvc;
    @Autowired
    private AccountRepository accounts;
    @Autowired
    private UserRepository users;
    @Autowired
    private JdbcTemplate jdbc;

    @BeforeEach
    void setup() {
        accounts.deleteAll();
        users.deleteAll();
        users.save(new User("Arthur", "arthur@example.com", "unused"));
        users.save(new User("Maria", "maria@example.com", "unused"));
    }

    @Test
    void shouldRenameWithoutChangingBalance() throws Exception {
        Account account = createAccount("arthur@example.com");
        mvc.perform(patch("/api/accounts/{id}", account.getId())
                .with(user("arthur@example.com")).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"name":" Nova conta ","initialBalance":"5000.00"}
                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Nova conta"))
                .andExpect(jsonPath("$.initialBalance").value("-125.90"))
                .andExpect(jsonPath("$.currentBalance").value("-125.90"));
        assertEquals("Nova conta", accounts.findById(account.getId()).orElseThrow().getName());
    }

    @Test
    void shouldDeleteOwnAccount() throws Exception {
        Account account = createAccount("arthur@example.com");
        mvc.perform(delete("/api/accounts/{id}", account.getId())
                .with(user("arthur@example.com")).with(csrf()))
                .andExpect(status().isNoContent());
        assertEquals(0, accounts.count());
        mvc.perform(get("/api/accounts").with(user("arthur@example.com")))
                .andExpect(content().json("[]"));
    }

    @Test
    void shouldNotChangeAnotherUsersAccount() throws Exception {
        Account account = createAccount("maria@example.com");
        for (Long id : new Long[] {account.getId(), 0L}) {
            mvc.perform(patch("/api/accounts/{id}", id)
                    .with(user("arthur@example.com")).with(csrf())
                    .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Outro nome\"}"))
                    .andExpect(status().isNotFound());
            mvc.perform(delete("/api/accounts/{id}", id)
                    .with(user("arthur@example.com")).with(csrf()))
                    .andExpect(status().isNotFound());
        }
        assertEquals("Carteira", accounts.findById(account.getId()).orElseThrow().getName());
        assertEquals(1, accounts.count());
    }

    @Test
    void shouldValidateNewName() throws Exception {
        Account account = createAccount("arthur@example.com");
        for (String name : new String[] {" ", "a".repeat(101)}) {
            mvc.perform(patch("/api/accounts/{id}", account.getId())
                    .with(user("arthur@example.com")).with(csrf())
                    .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"" + name + "\"}"))
                    .andExpect(status().isBadRequest());
        }
        assertEquals("Carteira", accounts.findById(account.getId()).orElseThrow().getName());
    }

    @Test
    void shouldProtectRenameAndDelete() throws Exception {
        Account account = createAccount("arthur@example.com");
        mvc.perform(patch("/api/accounts/{id}", account.getId()).with(csrf()))
                .andExpect(status().isUnauthorized());
        mvc.perform(delete("/api/accounts/{id}", account.getId()).with(csrf()))
                .andExpect(status().isUnauthorized());
        mvc.perform(patch("/api/accounts/{id}", account.getId()).with(user("arthur@example.com")))
                .andExpect(status().isForbidden());
        mvc.perform(delete("/api/accounts/{id}", account.getId()).with(user("arthur@example.com")))
                .andExpect(status().isForbidden());
        assertEquals(1, accounts.count());
    }

    @Test
    void shouldKeepAccountWithLinkedRecords() throws Exception {
        Account account = createAccount("arthur@example.com");
        jdbc.execute("CREATE TABLE account_reference_test (account_id BIGINT REFERENCES account(id))");
        try {
            jdbc.update("INSERT INTO account_reference_test VALUES (?)", account.getId());
            mvc.perform(delete("/api/accounts/{id}", account.getId())
                    .with(user("arthur@example.com")).with(csrf()))
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.title").value("Conta em uso"));
            assertEquals(1, accounts.count());
        } finally {
            jdbc.execute("DROP TABLE account_reference_test");
        }
    }

    private Account createAccount(String email) {
        Long userId = users.findByEmail(email).orElseThrow().getId();
        return accounts.saveAndFlush(new Account(userId, "Carteira", new BigDecimal("-125.90")));
    }

    @Test
    void shouldCreateAccountWithNegativeBalance() throws Exception {
        mvc.perform(post("/api/accounts").with(user("arthur@example.com")).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"name":" Carteira ","initialBalance":"-125.90"}
                        """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.name").value("Carteira"))
                .andExpect(jsonPath("$.initialBalance").value("-125.90"))
                .andExpect(jsonPath("$.currentBalance").value("-125.90"))
                .andExpect(jsonPath("$.userId").doesNotExist());

        mvc.perform(get("/api/accounts").with(user("arthur@example.com")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].currentBalance").value("-125.90"));
    }

    @Test
    void shouldUseAuthenticatedOwner() throws Exception {
        Long mariaId = users.findByEmail("maria@example.com").orElseThrow().getId();
        mvc.perform(post("/api/accounts").with(user("arthur@example.com")).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"name":"Conta","initialBalance":"100.00","userId":%d}
                        """.formatted(mariaId)))
                .andExpect(status().isCreated());

        mvc.perform(get("/api/accounts").param("userId", mariaId.toString())
                .with(user("arthur@example.com")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));
        mvc.perform(get("/api/accounts").with(user("maria@example.com")))
                .andExpect(status().isOk())
                .andExpect(content().json("[]"));
    }

    @Test
    void shouldKeepDecimalPrecisionAndOrder() throws Exception {
        for (String balance : new String[] { "0", "0.10", "99999999999999999.99" }) {
            mvc.perform(post("/api/accounts").with(user("arthur@example.com")).with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""
                            {"name":"Conta %s","initialBalance":"%s"}
                            """.formatted(balance, balance)))
                    .andExpect(status().isCreated());
        }

        mvc.perform(get("/api/accounts").with(user("arthur@example.com")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[0].initialBalance").value("0.00"))
                .andExpect(jsonPath("$[1].currentBalance").value("0.10"))
                .andExpect(jsonPath("$[2].currentBalance").value("99999999999999999.99"));
    }

    @Test
    void shouldRejectInvalidFields() throws Exception {
        for (String balance : new String[] { "null", "\"1.001\"", "\"100000000000000000.00\"", "\"abc\"" }) {
            mvc.perform(post("/api/accounts").with(user("arthur@example.com")).with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"name\":\"Conta\",\"initialBalance\":" + balance + "}"))
                    .andExpect(status().isBadRequest());
        }
        for (String name : new String[] { " ", "a".repeat(101) }) {
            mvc.perform(post("/api/accounts").with(user("arthur@example.com")).with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"name\":\"" + name + "\",\"initialBalance\":\"0.00\"}"))
                    .andExpect(status().isBadRequest());
        }
        assertEquals(0, accounts.count());
    }

    @Test
    void shouldRequireAuthenticationAndCsrf() throws Exception {
        mvc.perform(get("/api/accounts")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/accounts").with(csrf()))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/accounts").with(user("arthur@example.com")))
                .andExpect(status().isForbidden());
        assertEquals(0, accounts.count());
    }
}
