package br.com.monviflow.user;

import br.com.monviflow.category.Category;
import br.com.monviflow.category.CategoryRepository;
import br.com.monviflow.category.CategoryType;
import java.util.List;
import java.util.Locale;

import org.hibernate.exception.ConstraintViolationException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final CategoryRepository categories;

    public UserService(
        UserRepository userRepository,
        PasswordEncoder passwordEncoder,
        CategoryRepository categories
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.categories = categories;
    }

    @Transactional
    public UserResponse create(CreateUserRequest request) {
        String name = request.name().strip();
        String email = request.email()
            .strip()
            .toLowerCase(Locale.ROOT);

        if (userRepository.existsByEmail(email)) {
            throw new EmailAlreadyRegisteredException();
        }

        String passwordHash = passwordEncoder.encode(request.password());

        User user = new User(name, email, passwordHash);
        try {
            User savedUser = userRepository.saveAndFlush(user);
            categories.saveAllAndFlush(List.of(
                new Category(savedUser.getId(), "Salário", CategoryType.INCOME),
                new Category(savedUser.getId(), "Outras receitas", CategoryType.INCOME),
                new Category(savedUser.getId(), "Alimentação", CategoryType.EXPENSE),
                new Category(savedUser.getId(), "Moradia", CategoryType.EXPENSE),
                new Category(savedUser.getId(), "Transporte", CategoryType.EXPENSE),
                new Category(savedUser.getId(), "Saúde", CategoryType.EXPENSE),
                new Category(savedUser.getId(), "Lazer", CategoryType.EXPENSE),
                new Category(savedUser.getId(), "Outras despesas", CategoryType.EXPENSE)
            ));
            return UserResponse.from(savedUser);
        } catch (DataIntegrityViolationException exception) {
            // Duas requisições podem passar pela consulta de existência ao mesmo tempo.
            for (Throwable cause = exception; cause != null; cause = cause.getCause()) {
                if (cause instanceof ConstraintViolationException violation
                    && "ux_app_user_email".equals(violation.getConstraintName())) {
                    throw new EmailAlreadyRegisteredException();
                }
            }
            throw exception;
        }
    }
}
