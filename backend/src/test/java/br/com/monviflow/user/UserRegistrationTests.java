package br.com.monviflow.user;

import br.com.monviflow.PostgresIntegrationTest;
import br.com.monviflow.category.CategoryRepository;
import br.com.monviflow.category.CategoryType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.Executors;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class UserRegistrationTests extends PostgresIntegrationTest {

    private static final String USER = """
        {"name":"Arthur","email":"arthur@example.com","password":"SenhaFicticia123!"}
        """;

    @Autowired
    private MockMvc mvc;

    @Autowired
    private UserRepository repository;

    @Autowired
    private PasswordEncoder encoder;

    @Autowired
    private CategoryRepository categories;

    @Autowired
    private JdbcTemplate jdbc;

    @BeforeEach
    void clearUsers() {
        categories.deleteAll();
        repository.deleteAll();
    }

    @Test
    void shouldRegisterUser() throws Exception {
        register("""
            {"name":" Arthur ","email":" ARTHUR@EXAMPLE.COM ","password":"SenhaFicticia123!"}
            """)
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").isNumber())
            .andExpect(jsonPath("$.name").value("Arthur"))
            .andExpect(jsonPath("$.email").value("arthur@example.com"))
            .andExpect(jsonPath("$.createdAt").exists())
            .andExpect(jsonPath("$.password").doesNotExist())
            .andExpect(jsonPath("$.passwordHash").doesNotExist());

        User user = repository.findByEmail("arthur@example.com").orElseThrow();
        assertTrue(encoder.matches("SenhaFicticia123!", user.getPasswordHash()));
        assertFalse(encoder.matches("SenhaErrada", user.getPasswordHash()));
        var initial = categories.findAllByUserIdOrderByIdAsc(user.getId());
        assertEquals(List.of("Salário", "Outras receitas", "Alimentação", "Moradia",
                "Transporte", "Saúde", "Lazer", "Outras despesas"),
                initial.stream().map(category -> category.getName()).toList());
        assertEquals(2, initial.stream().filter(category -> category.getType() == CategoryType.INCOME).count());
        assertEquals(6, initial.stream().filter(category -> category.getType() == CategoryType.EXPENSE).count());
    }

    @Test
    void shouldRejectDuplicateEmail() throws Exception {
        register(USER)
            .andExpect(status().isCreated());

        register(USER.replace("arthur@example.com", "ARTHUR@EXAMPLE.COM"))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.status").value(409));

        assertEquals(1, repository.count());
        assertEquals(8, categories.count());
    }

    @Test
    void shouldRejectInvalidFields() throws Exception {
        String response = register("""
                {"name":" ","email":"invalid","password":"secret"}
                """)
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.fields.length()").value(3))
            .andReturn().getResponse().getContentAsString();

        assertFalse(response.contains("secret"));
        assertEquals(0, repository.count());
        assertEquals(0, categories.count());
    }

    @Test
    void shouldRejectInvalidBody() throws Exception {
        for (String body : new String[] {"{}", "null", "{"}) {
            register(body)
                .andExpect(status().isBadRequest());
        }
        assertEquals(0, repository.count());
    }

    @Test
    void shouldRejectConcurrentDuplicate() throws Exception {
        var start = new CyclicBarrier(2);
        Callable<Integer> register = () -> {
            start.await(10, TimeUnit.SECONDS);
            return register(USER).andReturn().getResponse().getStatus();
        };

        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(register);
            var second = executor.submit(register);
            var statuses = new ArrayList<>(List.of(
                first.get(30, TimeUnit.SECONDS), second.get(30, TimeUnit.SECONDS)));
            statuses.sort(Integer::compareTo);
            assertEquals(List.of(201, 409), statuses);
        }
        assertEquals(1, repository.count());
        assertEquals(8, categories.count());
    }

    @Test
    void shouldGiveEachUserTheirOwnCategories() throws Exception {
        register(USER).andExpect(status().isCreated());
        register(USER.replace("arthur@example.com", "maria@example.com"))
                .andExpect(status().isCreated());
        var arthur = categories.findAllByUserIdOrderByIdAsc(
                repository.findByEmail("arthur@example.com").orElseThrow().getId());
        var maria = categories.findAllByUserIdOrderByIdAsc(
                repository.findByEmail("maria@example.com").orElseThrow().getId());
        assertEquals(8, arthur.size());
        assertEquals(8, maria.size());
        assertTrue(arthur.stream().noneMatch(first -> maria.stream()
                .anyMatch(second -> first.getId().equals(second.getId()))));
        mvc.perform(get("/api/categories").with(user("maria@example.com")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(8));
    }

    @Test
    void shouldRollbackRegistrationWhenCategoriesCannotBeSaved() throws Exception {
        jdbc.execute("ALTER TABLE category ADD CONSTRAINT reject_initial_test CHECK (name <> 'Salário')");
        try {
            register(USER).andExpect(status().isInternalServerError());
            assertEquals(0, repository.count());
            assertEquals(0, categories.count());
        } finally {
            jdbc.execute("ALTER TABLE category DROP CONSTRAINT reject_initial_test");
        }
    }

    private ResultActions register(String body) throws Exception {
        return mvc.perform(post("/api/users")
            .with(csrf())
            .contentType(MediaType.APPLICATION_JSON)
            .content(body));
    }
}
