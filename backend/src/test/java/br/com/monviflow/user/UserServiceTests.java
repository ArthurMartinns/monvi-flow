package br.com.monviflow.user;

import java.sql.SQLException;

import org.hibernate.exception.ConstraintViolationException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserServiceTests {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @InjectMocks
    private UserService userService;

    @Test
    void shouldCreateUser() {
        String password = " SenhaFicticia123! ";
        var request = new CreateUserRequest(
            "  Arthur Martins  ", "  ARTHUR@EXAMPLE.COM  ", password
        );
        when(userRepository.existsByEmail("arthur@example.com")).thenReturn(false);
        when(passwordEncoder.encode(password)).thenReturn("encoded-password");
        when(userRepository.saveAndFlush(any(User.class)))
            .thenAnswer(invocation -> invocation.getArgument(0));

        UserResponse response = userService.create(request);

        var captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).saveAndFlush(captor.capture());
        User savedUser = captor.getValue();

        assertEquals("Arthur Martins", savedUser.getName());
        assertEquals("arthur@example.com", savedUser.getEmail());
        assertEquals("encoded-password", savedUser.getPasswordHash());
        assertNotNull(savedUser.getCreatedAt());

        assertEquals(savedUser.getName(), response.name());
        assertEquals(savedUser.getEmail(), response.email());
        assertEquals(savedUser.getCreatedAt(), response.createdAt());
        verify(passwordEncoder).encode(password);
    }

    @Test
    void shouldRejectDuplicateEmail() {
        var request = new CreateUserRequest(
            "Arthur", " ARTHUR@EXAMPLE.COM ", "SenhaFicticia123!"
        );
        when(userRepository.existsByEmail("arthur@example.com")).thenReturn(true);

        assertThrows(EmailAlreadyRegisteredException.class,
            () -> userService.create(request));

        verifyNoInteractions(passwordEncoder);
        verify(userRepository, never()).saveAndFlush(any(User.class));
    }

    @Test
    void shouldThrowWhenSaveFails() {
        var request = new CreateUserRequest(
            "Arthur", "arthur@example.com", "SenhaFicticia123!"
        );
        when(userRepository.existsByEmail(request.email())).thenReturn(false);
        when(passwordEncoder.encode(request.password())).thenReturn("encoded-password");
        when(userRepository.saveAndFlush(any(User.class)))
            .thenThrow(new DataIntegrityViolationException("Erro ao salvar"));

        assertThrows(DataIntegrityViolationException.class,
            () -> userService.create(request));
    }

    @Test
    void shouldRejectDuplicateEmailFromDatabase() {
        var request = new CreateUserRequest(
            "Arthur", "arthur@example.com", "SenhaFicticia123!"
        );
        when(userRepository.existsByEmail(request.email())).thenReturn(false);
        when(passwordEncoder.encode(request.password())).thenReturn("encoded-password");
        var violation = new ConstraintViolationException(
            "Duplicate email", new SQLException("Duplicate key", "23505"), "ux_app_user_email"
        );
        when(userRepository.saveAndFlush(any(User.class)))
            .thenThrow(new DataIntegrityViolationException("Erro ao salvar", violation));

        assertThrows(EmailAlreadyRegisteredException.class,
            () -> userService.create(request));
    }
}

