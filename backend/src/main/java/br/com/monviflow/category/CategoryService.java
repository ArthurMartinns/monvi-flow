package br.com.monviflow.category;

import br.com.monviflow.user.UserRepository;
import br.com.monviflow.budget.BudgetRepository;
import java.util.List;
import org.hibernate.exception.ConstraintViolationException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional(readOnly = true)
public class CategoryService {

    private final CategoryRepository categories;
    private final UserRepository users;
    private final BudgetRepository budgets;

    public CategoryService(CategoryRepository categories, UserRepository users, BudgetRepository budgets) {
        this.categories = categories;
        this.users = users;
        this.budgets = budgets;
    }

    @Transactional
    public CategoryResponse create(String email, CreateCategoryRequest request) {
        return CategoryResponse.from(categories.save(
                new Category(userId(email), request.name(), request.type())));
    }

    public List<CategoryResponse> list(String email) {
        return categories.findAllByUserIdOrderByIdAsc(userId(email))
                .stream().map(CategoryResponse::from).toList();
    }

    @Transactional
    public CategoryResponse rename(String email, Long id, RenameCategoryRequest request) {
        Category category = find(email, id);
        category.rename(request.name());
        return CategoryResponse.from(category);
    }

    @Transactional
    public void delete(String email, Long id) {
        Category category = find(email, id);
        try {
            budgets.deleteByUserIdAndCategoryId(category.getUserId(), category.getId());
            categories.delete(category);
            categories.flush();
        } catch (DataIntegrityViolationException exception) {
            for (Throwable cause = exception; cause != null; cause = cause.getCause()) {
                if (cause instanceof ConstraintViolationException violation
                        && "23503".equals(violation.getSQLState())) {
                    throw new CategoryInUseException();
                }
            }
            throw exception;
        }
    }

    private Category find(String email, Long id) {
        return categories.findByIdAndUserId(id, userId(email))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }

    private Long userId(String email) {
        return users.findByEmail(email).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.UNAUTHORIZED)).getId();
    }
}
