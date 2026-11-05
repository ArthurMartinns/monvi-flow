package br.com.monviflow.overview;

import br.com.monviflow.account.AccountRepository;
import br.com.monviflow.budget.BudgetService;
import br.com.monviflow.transaction.TransactionRepository;
import br.com.monviflow.transaction.TransactionResponse;
import br.com.monviflow.user.UserRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.data.domain.PageRequest;
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
        public OverviewResponse get(String email, YearMonth month, Long accountId) {
                if (month.getYear() < 1 || month.getYear() > 9999 || accountId != null && accountId <= 0)
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
                Long userId = users.findByEmail(email).orElseThrow(
                                () -> new ResponseStatusException(HttpStatus.UNAUTHORIZED)).getId();
                var balances = accounts.findSummaries(userId, accountId);
                if (accountId != null && balances.isEmpty())
                        throw new ResponseStatusException(HttpStatus.NOT_FOUND);
                var daily = transactions.dailyTotals(userId, month.atDay(1), month.plusMonths(1).atDay(1), accountId);
                var income = daily.stream().map(TransactionRepository.DailyTotal::getIncome).reduce(BigDecimal.ZERO,
                                BigDecimal::add);
                var expense = daily.stream().map(TransactionRepository.DailyTotal::getExpense).reduce(BigDecimal.ZERO,
                                BigDecimal::add);
                var balance = balances.stream().map(AccountRepository.Summary::getCurrentBalance).reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add);
                return new OverviewResponse(month.toString(), money(balance), balances.size(), money(income),
                                money(expense),
                                money(income.subtract(expense)),
                                daily.stream().mapToLong(TransactionRepository.DailyTotal::getCount).sum(),
                                daily.stream()
                                                .map(day -> new OverviewResponse.Day(day.getDay(),
                                                                money(day.getIncome()),
                                                                money(day.getExpense())))
                                                .toList(),
                                transactions.expenseTotals(
                                                userId, month.atDay(1), month.plusMonths(1).atDay(1), accountId)
                                                .stream()
                                                .map(category -> new OverviewResponse.Category(category.getId(),
                                                                category.getName(),
                                                                money(category.getAmount())))
                                                .toList(),
                                budgets.list(email, month),
                                history(userId, month, accountId),
                                transactions.recent(userId, month.atDay(1), month.plusMonths(1).atDay(1),
                                                accountId, PageRequest.of(0, 5)).stream()
                                                .map(TransactionResponse::from).toList());
        }

        private List<OverviewResponse.Month> history(Long userId, YearMonth month, Long accountId) {
                var start = month.minusMonths(Math.min(5, (month.getYear() - 1) * 12L + month.getMonthValue() - 1));
                var totals = transactions.monthlyTotals(userId, start.atDay(1), month.plusMonths(1).atDay(1), accountId)
                                .stream().collect(Collectors.toMap(TransactionRepository.MonthlyTotal::getMonth,
                                                Function.identity()));
                var result = new ArrayList<OverviewResponse.Month>();
                for (var current = start; !current.isAfter(month); current = current.plusMonths(1)) {
                        var total = totals.get(current.atDay(1));
                        var income = total == null ? BigDecimal.ZERO : total.getIncome();
                        var expense = total == null ? BigDecimal.ZERO : total.getExpense();
                        result.add(new OverviewResponse.Month(current.toString(), money(income), money(expense),
                                        money(income.subtract(expense))));
                }
                return result;
        }

        private String money(BigDecimal value) {
                return value.setScale(2, RoundingMode.UNNECESSARY).toPlainString();
        }
}
