package br.com.monviflow.overview;

import br.com.monviflow.account.AccountRepository;
import br.com.monviflow.budget.BudgetService;
import br.com.monviflow.transaction.TransactionRepository;
import br.com.monviflow.user.UserRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.YearMonth;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class OverviewService {
    private final AccountRepository accounts;
    private final TransactionRepository transactions;
    private final UserRepository users;
    private final BudgetService budgets;

    public OverviewService(AccountRepository accounts, TransactionRepository transactions, UserRepository users,
            BudgetService budgets) {
        this.accounts = accounts;
        this.transactions = transactions;
        this.users = users;
        this.budgets = budgets;
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public OverviewResponse get(String email, YearMonth month) {
        if (month.getYear() < 1 || month.getYear() > 9999)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        Long userId = users.findByEmail(email).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.UNAUTHORIZED)).getId();
        var balances = accounts.findSummaries(userId, null);
        var daily = transactions.dailyTotals(userId, month.atDay(1), month.plusMonths(1).atDay(1));
        var income = daily.stream().map(TransactionRepository.DailyTotal::getIncome).reduce(BigDecimal.ZERO,
                BigDecimal::add);
        var expense = daily.stream().map(TransactionRepository.DailyTotal::getExpense).reduce(BigDecimal.ZERO,
                BigDecimal::add);
        var balance = balances.stream().map(AccountRepository.Summary::getCurrentBalance).reduce(BigDecimal.ZERO,
                BigDecimal::add);
        return new OverviewResponse(month.toString(), money(balance), balances.size(), money(income), money(expense),
                money(income.subtract(expense)),
                daily.stream().mapToLong(TransactionRepository.DailyTotal::getCount).sum(),
                daily.stream()
                        .map(day -> new OverviewResponse.Day(day.getDay(), money(day.getIncome()),
                                money(day.getExpense())))
                        .toList(),
                transactions.expenseTotals(userId, month.atDay(1), month.plusMonths(1).atDay(1)).stream()
                        .map(category -> new OverviewResponse.Category(category.getId(), category.getName(),
                                money(category.getAmount())))
                        .toList(),
                budgets.list(email, month));
    }

    private String money(BigDecimal value) {
        return value.setScale(2, RoundingMode.UNNECESSARY).toPlainString();
    }
}
