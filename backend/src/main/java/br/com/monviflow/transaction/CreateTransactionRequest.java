package br.com.monviflow.transaction;

import java.math.BigDecimal;
import java.time.LocalDate;
import jakarta.validation.constraints.*;

public record CreateTransactionRequest(
        @NotNull @Positive Long accountId,
        @NotNull @Positive Long categoryId,
        @NotBlank @Size(max = 255) String description,
        @NotNull @DecimalMin("0.01") @Digits(integer = 17, fraction = 2) BigDecimal amount,
        @NotNull @PastOrPresent LocalDate date) {
    public CreateTransactionRequest {
        description = description == null ? null : description.strip();
    }
}
