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
import org.springframework.test.web.servlet.MockMvc;

import static org.junit.jupiter.api.Assertions.assertEquals;
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
}
