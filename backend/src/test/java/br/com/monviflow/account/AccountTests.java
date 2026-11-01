package br.com.monviflow.account;

import br.com.monviflow.PostgresIntegrationTest;
import br.com.monviflow.user.User;
import br.com.monviflow.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
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

    @BeforeEach
    void setup() {
        accounts.deleteAll();
        users.deleteAll();
        users.save(new User("Arthur", "arthur@example.com", "unused"));
        users.save(new User("Maria", "maria@example.com", "unused"));
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
