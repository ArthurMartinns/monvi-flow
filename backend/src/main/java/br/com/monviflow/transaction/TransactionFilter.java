package br.com.monviflow.transaction;

import br.com.monviflow.category.CategoryType;
import java.time.LocalDate;
import jakarta.validation.constraints.*;

public record TransactionFilter(LocalDate from, LocalDate to,
        @Positive Long accountId, @Positive Long categoryId, CategoryType type,
        @Size(max = 100) String query, @Min(0) Integer page, @Min(1) @Max(100) Integer size) {
    public TransactionFilter {
        query = query == null ? null : query.strip();
        page = page == null ? 0 : page;
        size = size == null ? 20 : size;
    }

    @AssertTrue(message = "O início do período deve ser anterior ao fim.")
    public boolean isValidPeriod() {
        return from == null || to == null || !from.isAfter(to);
    }
}
