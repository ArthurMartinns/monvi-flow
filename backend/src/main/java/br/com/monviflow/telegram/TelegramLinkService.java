package br.com.monviflow.telegram;

import br.com.monviflow.user.UserRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class TelegramLinkService {
    private final JdbcTemplate jdbc;
    private final UserRepository users;
    private final SecureRandom random = new SecureRandom();
    private final boolean enabled;
    private final String botUsername;

    public TelegramLinkService(JdbcTemplate jdbc, UserRepository users,
            @Value("${telegram.enabled:false}") boolean enabled,
            @Value("${telegram.bot-token:}") String botToken,
            @Value("${telegram.bot-username:}") String botUsername) {
        this.jdbc = jdbc;
        this.users = users;
        this.enabled = enabled && !botToken.isBlank();
        this.botUsername = botUsername;
    }

    public LinkStatus status(String email) {
        Long userId = userId(email);
        Boolean linked = jdbc.queryForObject(
                "SELECT EXISTS (SELECT 1 FROM telegram_link WHERE user_id = ?)", Boolean.class, userId);
        return new LinkStatus(enabled, Boolean.TRUE.equals(linked), botUsername);
    }

    @Transactional
    public LinkCode createCode(String email) {
        if (!enabled)
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Bot não configurado.");
        Long userId = userId(email);
        byte[] bytes = new byte[24];
        random.nextBytes(bytes);
        String code = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        Instant expiresAt = Instant.now().plusSeconds(600);
        jdbc.update("""
                INSERT INTO telegram_link_code (user_id, code_hash, expires_at) VALUES (?, ?, ?)
                ON CONFLICT (user_id) DO UPDATE SET code_hash = EXCLUDED.code_hash, expires_at = EXCLUDED.expires_at
                """, userId, hash(code), OffsetDateTime.ofInstant(expiresAt, ZoneOffset.UTC));
        return new LinkCode(code, expiresAt);
    }

    @Transactional
    public void unlink(String email) {
        Long userId = userId(email);
        jdbc.update("DELETE FROM telegram_link_code WHERE user_id = ?", userId);
        jdbc.update("DELETE FROM telegram_link WHERE user_id = ?", userId);
    }

    @Transactional
    public boolean link(String code, long telegramUserId) {
        if (code == null || code.length() != 32)
            return false;
        var owners = jdbc.query("""
                SELECT user_id FROM telegram_link_code
                WHERE code_hash = ? AND expires_at > CURRENT_TIMESTAMP FOR UPDATE
                """, (rs, row) -> rs.getLong(1), hash(code));
        if (owners.isEmpty())
            return false;
        Long owner = owners.getFirst();
        Boolean alreadyAssigned = jdbc.queryForObject("""
                SELECT EXISTS (SELECT 1 FROM telegram_link WHERE telegram_user_id = ? AND user_id <> ?)
                """, Boolean.class, telegramUserId, owner);
        if (Boolean.TRUE.equals(alreadyAssigned))
            return false;
        jdbc.update("DELETE FROM telegram_link WHERE user_id = ?", owner);
        jdbc.update("INSERT INTO telegram_link (user_id, telegram_user_id) VALUES (?, ?)", owner, telegramUserId);
        jdbc.update("DELETE FROM telegram_link_code WHERE user_id = ?", owner);
        return true;
    }

    public Optional<Long> userIdForTelegram(long telegramUserId) {
        return jdbc.query("SELECT user_id FROM telegram_link WHERE telegram_user_id = ?",
                (rs, row) -> rs.getLong(1), telegramUserId).stream().findFirst();
    }

    private Long userId(String email) {
        return users.findByEmail(email).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.UNAUTHORIZED)).getId();
    }

    private static String hash(String code) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(code.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (java.security.NoSuchAlgorithmException exception) {
            throw new IllegalStateException(exception);
        }
    }

    public record LinkStatus(boolean enabled, boolean linked, String botUsername) {
    }

    public record LinkCode(String code, Instant expiresAt) {
    }
}
