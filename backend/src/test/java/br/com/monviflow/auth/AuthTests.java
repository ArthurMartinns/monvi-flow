package br.com.monviflow.auth;

import br.com.monviflow.PostgresIntegrationTest;
import br.com.monviflow.user.User;
import br.com.monviflow.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class AuthTests extends PostgresIntegrationTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private UserRepository repository;

    @Autowired
    private PasswordEncoder encoder;

    @BeforeEach
    void createUser() {
        repository.deleteAll();
        repository.saveAndFlush(new User("Arthur", "arthur@example.com",
            encoder.encode("SenhaFicticia123!")));
    }

    @Test
    void shouldLoginAndGetCurrentUser() throws Exception {
        MvcResult tokenResult = mvc.perform(get("/api/auth/csrf"))
            .andExpect(status().isOk()).andReturn();
        var session = (MockHttpSession) tokenResult.getRequest().getSession();
        String oldId = session.getId();

        login(session, token(tokenResult), " ARTHUR@EXAMPLE.COM ", "SenhaFicticia123!")
            .andExpect(status().isNoContent());

        assertNotEquals(oldId, session.getId());
        mvc.perform(get("/api/auth/me").session(session))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").isNumber())
            .andExpect(jsonPath("$.email").value("arthur@example.com"))
            .andExpect(jsonPath("$.password").doesNotExist())
            .andExpect(jsonPath("$.passwordHash").doesNotExist());
    }

    @Test
    void shouldRejectInvalidCredentials() throws Exception {
        for (String email : new String[] {"arthur@example.com", "missing@example.com"}) {
            MvcResult result = mvc.perform(get("/api/auth/csrf")).andReturn();
            var session = (MockHttpSession) result.getRequest().getSession();

            login(session, token(result), email, "SenhaErrada")
                .andExpect(status().isUnauthorized());
            mvc.perform(get("/api/auth/me").session(session))
                .andExpect(status().isUnauthorized());
        }
    }

    @Test
    void shouldRequireLogin() throws Exception {
        mvc.perform(get("/api/auth/me"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void shouldRequireCsrf() throws Exception {
        for (String path : new String[] {"/api/users", "/api/auth/login", "/api/auth/logout"}) {
            mvc.perform(post(path)).andExpect(status().isForbidden());
            mvc.perform(post(path).header("X-CSRF-TOKEN", "invalid"))
                .andExpect(status().isForbidden());
        }
    }

    @Test
    void shouldLogoutAndInvalidateSession() throws Exception {
        MvcResult beforeLogin = mvc.perform(get("/api/auth/csrf")).andReturn();
        var session = (MockHttpSession) beforeLogin.getRequest().getSession();
        login(session, token(beforeLogin), "arthur@example.com", "SenhaFicticia123!")
            .andExpect(status().isNoContent());

        mvc.perform(post("/api/auth/logout").session(session))
            .andExpect(status().isForbidden());
        mvc.perform(post("/api/auth/logout").session(session)
            .header("X-CSRF-TOKEN", token(beforeLogin).getToken()))
            .andExpect(status().isForbidden());

        MvcResult afterLogin = mvc.perform(get("/api/auth/csrf").session(session)).andReturn();
        mvc.perform(post("/api/auth/logout").session(session)
            .header("X-CSRF-TOKEN", token(afterLogin).getToken()))
            .andExpect(status().isNoContent())
            .andExpect(cookie().maxAge("JSESSIONID", 0));

        assertTrue(session.isInvalid());
        mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
    }

    @Test
    void shouldUpdateOnlyAuthenticatedUsersName() throws Exception {
        var original = repository.findByEmail("arthur@example.com").orElseThrow();
        var other = repository.saveAndFlush(new User("Maria", "maria@example.com", "unchanged"));
        mvc.perform(patch("/api/users/me").with(user("arthur@example.com")).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\" Arthur Martins \",\"id\":" + other.getId()
                        + ",\"email\":\"outro@example.com\",\"password\":\"outra-senha\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(original.getId()))
                .andExpect(jsonPath("$.name").value("Arthur Martins"))
                .andExpect(jsonPath("$.email").value("arthur@example.com"))
                .andExpect(jsonPath("$.passwordHash").doesNotExist());
        var updated = repository.findById(original.getId()).orElseThrow();
        assertEquals("Arthur Martins", updated.getName());
        assertEquals(original.getPasswordHash(), updated.getPasswordHash());
        assertEquals(original.getCreatedAt(), updated.getCreatedAt());
        assertEquals("Maria", repository.findById(other.getId()).orElseThrow().getName());
        mvc.perform(get("/api/auth/me").with(user("arthur@example.com")))
                .andExpect(jsonPath("$.name").value("Arthur Martins"));
    }

    @Test
    void shouldValidateProfileName() throws Exception {
        for (String body : new String[] { "{}", "{\"name\":null}", "{\"name\":\" \"}",
                "{\"name\":\"" + "a".repeat(101) + "\"}" }) {
            mvc.perform(patch("/api/users/me").with(user("arthur@example.com")).with(csrf())
                    .contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isBadRequest()).andExpect(jsonPath("$.fields[0]").value("name"));
        }
        assertEquals("Arthur", repository.findByEmail("arthur@example.com").orElseThrow().getName());
    }

    @Test
    void shouldProtectProfileUpdates() throws Exception {
        String body = "{\"name\":\"Outro nome\"}";
        mvc.perform(patch("/api/users/me").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isUnauthorized());
        mvc.perform(patch("/api/users/me").with(user("arthur@example.com"))
                .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isForbidden());
        mvc.perform(patch("/api/users/me").with(user("missing@example.com")).with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isUnauthorized());
    }

    private CsrfToken token(MvcResult result) {
        return (CsrfToken) result.getRequest().getAttribute(CsrfToken.class.getName());
    }

    private ResultActions login(
        MockHttpSession session, CsrfToken csrf, String email, String password
    ) throws Exception {
        return mvc.perform(post("/api/auth/login").session(session)
            .with(request -> {
                request.setRequestedSessionId(session.getId());
                request.setRequestedSessionIdValid(true);
                return request;
            })
            .header(csrf.getHeaderName(), csrf.getToken())
            .param("email", email).param("password", password));
    }
}
