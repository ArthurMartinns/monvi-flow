package br.com.monviflow.budget;

import br.com.monviflow.category.CategoryRepository;
import br.com.monviflow.category.CategoryType;
import br.com.monviflow.user.UserRepository;
import java.time.YearMonth;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional(readOnly = true)
public class BudgetService {
    private final BudgetRepository budgets;
    private final CategoryRepository categories;
    private final UserRepository users;

    public BudgetService(BudgetRepository budgets, CategoryRepository categories, UserRepository users) {
        this.budgets = budgets;
        this.categories = categories;
        this.users = users;
    }

    public List<BudgetResponse> list(String email, YearMonth month) {
        validateMonth(month);
        return budgets.findSummaries(userId(email), month.atDay(1), month.plusMonths(1).atDay(1))
                .stream().map(budget -> BudgetResponse.from(budget, month)).toList();
    }

    @Transactional
    public BudgetResponse save(String email, Long categoryId, BudgetRequest request) {
        validateMonth(request.month());
        Long userId = userId(email);
        var category = categories.findByIdAndUserId(categoryId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (category.getType() != CategoryType.EXPENSE)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        budgets.saveLimit(userId, categoryId, request.month().atDay(1), request.limitAmount());
        return budgets.findSummaries(userId, request.month().atDay(1), request.month().plusMonths(1).atDay(1)).stream()
                .filter(budget -> budget.getCategoryId().equals(categoryId))
                .map(budget -> BudgetResponse.from(budget, request.month())).findFirst().orElseThrow();
    }

    @Transactional
    public void delete(String email, Long id) {
        budgets.delete(budgets.findByIdAndUserId(id, userId(email))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND)));
    }

    private void validateMonth(YearMonth month) {
        if (month.getYear() < 1 || month.getYear() > 9999)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
    }

    private Long userId(String email) {
        return users.findByEmail(email).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.UNAUTHORIZED)).getId();
    }
}
