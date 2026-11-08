package br.com.monviflow.telegram;

import br.com.monviflow.category.CategoryType;
import br.com.monviflow.transaction.TransactionRepository;
import java.math.BigDecimal;
import java.text.NumberFormat;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class TelegramQueryService {
    private static final Locale PT_BR = Locale.forLanguageTag("pt-BR");
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private final TransactionRepository transactions;

    public TelegramQueryService(TransactionRepository transactions) {
        this.transactions = transactions;
    }

    public String recent(Long userId) {
        var rows = transactions.findTop5ByUserIdOrderByDateDescIdDesc(userId);
        if (rows.isEmpty())
            return "Você ainda não tem lançamentos.";
        var message = new StringBuilder("Últimos lançamentos:\n");
        for (var row : rows) {
            message.append('\n').append(row.getDate().format(DATE)).append(" • #").append(row.getId())
                    .append(" • ").append(row.getCategory().getType() == CategoryType.EXPENSE ? "−" : "+")
                    .append(money(row.getAmount())).append('\n')
                    .append(row.getDescription()).append(" — ").append(row.getAccount().getName()).append('\n');
        }
        return message.toString().strip();
    }

    public String summary(Long userId, YearMonth month) {
        var daily = transactions.dailyTotals(userId, month.atDay(1), month.plusMonths(1).atDay(1), null);
        var income = daily.stream().map(TransactionRepository.DailyTotal::getIncome)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        var expense = daily.stream().map(TransactionRepository.DailyTotal::getExpense)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return "Resumo de " + month.format(DateTimeFormatter.ofPattern("MMMM 'de' yyyy", PT_BR)) + ":\n"
                + "Receitas: " + money(income) + "\n"
                + "Despesas: " + money(expense) + "\n"
                + "Resultado: " + money(income.subtract(expense));
    }

    private String money(BigDecimal amount) {
        return NumberFormat.getCurrencyInstance(PT_BR).format(amount);
    }
}
