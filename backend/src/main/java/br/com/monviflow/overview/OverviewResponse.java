package br.com.monviflow.overview;

import java.util.List;
import java.time.LocalDate;

public record OverviewResponse(String month, String totalBalance, int accountCount,
        String income, String expense, String result, long transactionCount,
        List<Day> days, List<Category> categories) {
    public record Day(LocalDate date, String income, String expense) {}
    public record Category(Long id, String name, String amount) {}
}
