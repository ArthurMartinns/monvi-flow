package br.com.monviflow.config;

import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.junit.jupiter.api.Assertions.*;

class PasswordConfigTests {

    private final PasswordEncoder encoder = new PasswordConfig().passwordEncoder();

    @Test
    void shouldEncodePassword() {
        String password = "SenhaFicticia123!";

        String hash = encoder.encode(password);

        assertNotEquals(password, hash);
        assertTrue(encoder.matches(password, hash));
        assertFalse(encoder.matches("SenhaIncorreta", hash));
    }

    @Test
    void shouldGenerateDifferentHashes() {
        String firstHash = encoder.encode("SenhaFicticia123!");
        String secondHash = encoder.encode("SenhaFicticia123!");

        assertNotEquals(firstHash, secondHash);
        assertTrue(encoder.matches("SenhaFicticia123!", firstHash));
        assertTrue(encoder.matches("SenhaFicticia123!", secondHash));
    }
}
