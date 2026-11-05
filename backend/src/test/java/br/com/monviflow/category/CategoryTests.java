package br.com.monviflow.category;

import br.com.monviflow.PostgresIntegrationTest;
import br.com.monviflow.user.User;
import br.com.monviflow.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class CategoryTests extends PostgresIntegrationTest {

    @Autowired
    private MockMvc mvc;
    @Autowired
    private CategoryRepository categories;
    @Autowired
    private UserRepository users;
    @Autowired
    private JdbcTemplate jdbc;

    @BeforeEach
    void setup() {
        categories.deleteAll();
        users.deleteAll();
        users.save(new User("Arthur", "arthur@example.com", "unused"));
        users.save(new User("Maria", "maria@example.com", "unused"));
    }

    @Test
    void shouldCreateAndListCategories() throws Exception {
        for (String type : new String[] {"INCOME", "EXPENSE"}) {
            mvc.perform(post("/api/categories").with(user("arthur@example.com")).with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""
                            {"name":" Categoria ","type":"%s"}
                            """.formatted(type)))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.id").isNumber())
                    .andExpect(jsonPath("$.name").value("Categoria"))
                    .andExpect(jsonPath("$.type").value(type))
                    .andExpect(jsonPath("$.userId").doesNotExist());
        }
        mvc.perform(get("/api/categories").with(user("arthur@example.com")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].type").value("INCOME"))
                .andExpect(jsonPath("$[1].type").value("EXPENSE"));
    }

    @Test
    void shouldUseAuthenticatedOwner() throws Exception {
        Long mariaId = users.findByEmail("maria@example.com").orElseThrow().getId();
        mvc.perform(post("/api/categories").with(user("arthur@example.com")).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"name":"Salario","type":"INCOME","userId":%d}
                        """.formatted(mariaId)))
                .andExpect(status().isCreated());
        mvc.perform(get("/api/categories").param("userId", mariaId.toString())
                .with(user("arthur@example.com")))
                .andExpect(jsonPath("$.length()").value(1));
        mvc.perform(get("/api/categories").with(user("maria@example.com")))
                .andExpect(status().isOk())
                .andExpect(content().json("[]"));
    }

    @Test
    void shouldRejectInvalidFields() throws Exception {
        for (String body : new String[] {
                "{}",
                "{\"name\":\" \",\"type\":\"EXPENSE\"}",
                "{\"name\":\"" + "a".repeat(101) + "\",\"type\":\"INCOME\"}",
                "{\"name\":\"Categoria\",\"type\":null}",
                "{\"name\":\"Categoria\",\"type\":\"OTHER\"}",
                "{\"name\":\"Categoria\",\"type\":0}"}) {
            mvc.perform(post("/api/categories").with(user("arthur@example.com")).with(csrf())
                    .contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isBadRequest());
        }
        assertEquals(0, categories.count());
    }

    @Test
    void shouldRequireAuthenticationAndCsrf() throws Exception {
        mvc.perform(get("/api/categories")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/categories").with(csrf()))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/categories").with(user("arthur@example.com")))
                .andExpect(status().isForbidden());
        assertEquals(0, categories.count());
    }

    @Test
    void shouldRenameWithoutChangingType() throws Exception {
        Category category = createCategory("arthur@example.com");
        mvc.perform(patch("/api/categories/{id}", category.getId())
                .with(user("arthur@example.com")).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"name":" Transporte ","type":"INCOME"}
                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Transporte"))
                .andExpect(jsonPath("$.type").value("EXPENSE"));
        assertEquals("Transporte", categories.findById(category.getId()).orElseThrow().getName());
        assertEquals(CategoryType.EXPENSE, categories.findById(category.getId()).orElseThrow().getType());
    }

    @Test
    void shouldDeleteOwnCategory() throws Exception {
        Category category = createCategory("arthur@example.com");
        mvc.perform(delete("/api/categories/{id}", category.getId())
                .with(user("arthur@example.com")).with(csrf()))
                .andExpect(status().isNoContent());
        assertEquals(0, categories.count());
    }

    @Test
    void shouldNotChangeAnotherUsersCategory() throws Exception {
        Category category = createCategory("maria@example.com");
        for (Long id : new Long[] {category.getId(), 0L}) {
            mvc.perform(patch("/api/categories/{id}", id)
                    .with(user("arthur@example.com")).with(csrf())
                    .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Outro nome\"}"))
                    .andExpect(status().isNotFound());
            mvc.perform(delete("/api/categories/{id}", id)
                    .with(user("arthur@example.com")).with(csrf()))
                    .andExpect(status().isNotFound());
        }
        assertEquals(1, categories.count());
        assertEquals("Alimentacao", categories.findById(category.getId()).orElseThrow().getName());
    }

    @Test
    void shouldValidateNewName() throws Exception {
        Category category = createCategory("arthur@example.com");
        for (String body : new String[] {"{}", "{\"name\":null}", "{\"name\":\" \"}",
                "{\"name\":\"" + "a".repeat(101) + "\"}"}) {
            mvc.perform(patch("/api/categories/{id}", category.getId())
                    .with(user("arthur@example.com")).with(csrf())
                    .contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isBadRequest());
        }
        assertEquals("Alimentacao", categories.findById(category.getId()).orElseThrow().getName());
    }

    @Test
    void shouldProtectRenameAndDelete() throws Exception {
        Category category = createCategory("arthur@example.com");
        mvc.perform(patch("/api/categories/{id}", category.getId()).with(csrf()))
                .andExpect(status().isUnauthorized());
        mvc.perform(delete("/api/categories/{id}", category.getId()).with(csrf()))
                .andExpect(status().isUnauthorized());
        mvc.perform(patch("/api/categories/{id}", category.getId()).with(user("arthur@example.com")))
                .andExpect(status().isForbidden());
        mvc.perform(delete("/api/categories/{id}", category.getId()).with(user("arthur@example.com")))
                .andExpect(status().isForbidden());
        assertEquals(1, categories.count());
    }

    @Test
    void shouldKeepCategoryWithLinkedRecords() throws Exception {
        Category category = createCategory("arthur@example.com");
        jdbc.execute("CREATE TABLE category_reference_test (category_id BIGINT REFERENCES category(id))");
        try {
            jdbc.update("INSERT INTO category_reference_test VALUES (?)", category.getId());
            mvc.perform(delete("/api/categories/{id}", category.getId())
                    .with(user("arthur@example.com")).with(csrf()))
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.title").value("Categoria em uso"));
            assertEquals(1, categories.count());
        } finally {
            jdbc.execute("DROP TABLE category_reference_test");
        }
    }

    @Test
    void shouldRejectDuplicateNameIgnoringCaseAndSpaces() throws Exception {
        createCategory("arthur@example.com");
        postCategory("arthur@example.com", " ALIMENTACAO ", "EXPENSE")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.title").value("Categoria já cadastrada"))
                .andExpect(jsonPath("$.detail").value("Você já tem uma categoria com esse nome e tipo."));
        assertEquals(1, categories.count());
        postCategory("arthur@example.com", "Alimentacao", "INCOME").andExpect(status().isCreated());
        postCategory("maria@example.com", "Alimentacao", "EXPENSE").andExpect(status().isCreated());
        assertEquals(3, categories.count());
    }

    @Test
    void shouldKeepOriginalNameWhenRenameConflicts() throws Exception {
        Category first = createCategory("arthur@example.com");
        Long owner = users.findByEmail("arthur@example.com").orElseThrow().getId();
        Category second = categories.saveAndFlush(new Category(owner, "Lazer", CategoryType.EXPENSE));
        mvc.perform(patch("/api/categories/{id}", second.getId())
                .with(user("arthur@example.com")).with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\" alimentacao \"}"))
                .andExpect(status().isConflict());
        assertEquals("Lazer", categories.findById(second.getId()).orElseThrow().getName());
        mvc.perform(patch("/api/categories/{id}", first.getId())
                .with(user("arthur@example.com")).with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\" ALIMENTACAO \"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.name").value("ALIMENTACAO"));
    }

    @Test
    void shouldEnforceUniqueNamesInDatabase() {
        createCategory("arthur@example.com");
        Long owner = users.findByEmail("arthur@example.com").orElseThrow().getId();
        assertThrows(DataIntegrityViolationException.class, () -> categories.saveAndFlush(
                new Category(owner, " ALIMENTACAO ", CategoryType.EXPENSE)));
        assertEquals(1, categories.count());
    }

    @Test
    void shouldRejectConcurrentDuplicateCategories() throws Exception {
        var start = new CyclicBarrier(2);
        Callable<Integer> create = () -> {
            start.await(10, TimeUnit.SECONDS);
            return postCategory("arthur@example.com", "Mercado", "EXPENSE")
                    .andReturn().getResponse().getStatus();
        };
        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(create);
            var second = executor.submit(create);
            var statuses = new ArrayList<>(List.of(first.get(30, TimeUnit.SECONDS), second.get(30, TimeUnit.SECONDS)));
            statuses.sort(Integer::compareTo);
            assertEquals(List.of(201, 409), statuses);
        }
        assertEquals(1, categories.count());
    }

    private ResultActions postCategory(String email, String name, String type) throws Exception {
        return mvc.perform(post("/api/categories").with(user(email)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"%s\",\"type\":\"%s\"}".formatted(name, type)));
    }

    private Category createCategory(String email) {
        Long userId = users.findByEmail(email).orElseThrow().getId();
        return categories.saveAndFlush(new Category(userId, "Alimentacao", CategoryType.EXPENSE));
    }
}
