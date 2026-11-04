package br.com.monviflow.budget;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.YearMonth;

public record BudgetResponse(Long id, Long categoryId, String categoryName, String month,
        String limitAmount, String spent, String remaining) {
    public static BudgetResponse from(BudgetRepository.Summary budget, YearMonth month) {
        return new BudgetResponse(budget.getId(), budget.getCategoryId(), budget.getCategoryName(), month.toString(),
                money(budget.getLimitAmount()), money(budget.getSpent()), money(budget.getRemaining()));
    }

    private static String money(BigDecimal value) {
        return value.setScale(2, RoundingMode.UNNECESSARY).toPlainString();
    }
}
