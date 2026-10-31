package br.com.monviflow.user;

import br.com.monviflow.PostgresIntegrationTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
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

    @BeforeEach
    void clearUsers() {
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
    }

    @Test
    void shouldRejectDuplicateEmail() throws Exception {
        register(USER)
            .andExpect(status().isCreated());

        register(USER.replace("arthur@example.com", "ARTHUR@EXAMPLE.COM"))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.status").value(409));

        assertEquals(1, repository.count());
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
    }

    private ResultActions register(String body) throws Exception {
        return mvc.perform(post("/api/users")
            .contentType(MediaType.APPLICATION_JSON)
            .content(body));
    }
}
