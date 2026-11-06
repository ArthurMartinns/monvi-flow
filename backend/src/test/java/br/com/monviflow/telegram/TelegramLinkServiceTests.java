package br.com.monviflow.telegram;

import br.com.monviflow.PostgresIntegrationTest;
import br.com.monviflow.user.User;
import br.com.monviflow.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class TelegramLinkServiceTests extends PostgresIntegrationTest {
    @Autowired JdbcTemplate jdbc;
    @Autowired UserRepository users;

    @Test
    void createsOneTimeCodeAndLinksTelegramUser() {
        User user = users.saveAndFlush(new User("Demo", "telegram-demo@example.com", "unused"));
        TelegramLinkService links = new TelegramLinkService(jdbc, users, true, "test-token", "test-bot");

        var code = links.createCode(user.getEmail());

        assertEquals(32, code.code().length());
        assertEquals(1, jdbc.queryForObject(
                "SELECT count(*) FROM telegram_link_code WHERE user_id = ? AND expires_at > CURRENT_TIMESTAMP",
                Integer.class, user.getId()));
        assertFalse(links.link("invalid", 12345L));
        assertTrue(links.link(code.code(), 12345L));
        assertEquals(user.getId(), links.userIdForTelegram(12345L).orElseThrow());
        assertFalse(links.link(code.code(), 12345L));
    }
}
