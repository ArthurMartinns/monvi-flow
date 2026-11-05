package br.com.monviflow.overview;

import br.com.monviflow.budget.BudgetResponse;
import br.com.monviflow.transaction.TransactionResponse;
import java.util.List;
import java.time.LocalDate;

public record OverviewResponse(String month, String totalBalance, int accountCount,
        String income, String expense, String result, long transactionCount,
        List<Day> days, List<Category> categories, List<BudgetResponse> budgets,
        List<Month> months, List<TransactionResponse> recentTransactions) {
    public record Day(LocalDate date, String income, String expense) {
    }

    public record Category(Long id, String name, String amount) {
    }

    public record Month(String month, String income, String expense, String result) {
    }
}
