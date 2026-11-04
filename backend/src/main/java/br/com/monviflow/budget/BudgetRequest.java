package br.com.monviflow.budget;

import java.math.BigDecimal;
import java.time.YearMonth;
import jakarta.validation.constraints.*;

public record BudgetRequest(@NotNull YearMonth month,
                @NotNull @DecimalMin("0.01") @Digits(integer = 17, fraction = 2) BigDecimal limitAmount) {
}
