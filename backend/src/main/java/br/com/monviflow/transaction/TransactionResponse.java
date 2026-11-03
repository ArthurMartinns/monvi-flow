package br.com.monviflow.transaction;

import br.com.monviflow.category.CategoryType;
import java.math.RoundingMode;
import java.time.LocalDate;

public record TransactionResponse(Long id, Long accountId, String accountName,
        Long categoryId, String categoryName, CategoryType type,
        String description, String amount, LocalDate date) {

    public static TransactionResponse from(Transaction transaction) {
        return new TransactionResponse(transaction.getId(), transaction.getAccount().getId(),
                transaction.getAccount().getName(), transaction.getCategory().getId(),
                transaction.getCategory().getName(), transaction.getCategory().getType(),
                transaction.getDescription(),
                transaction.getAmount().setScale(2, RoundingMode.UNNECESSARY).toPlainString(),
                transaction.getDate());
    }
}
