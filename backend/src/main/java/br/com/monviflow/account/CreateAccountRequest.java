package br.com.monviflow.account;

import java.math.BigDecimal;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateAccountRequest(
        @NotBlank @Size(max = 100) String name,
        @NotNull @Digits(integer = 17, fraction = 2) BigDecimal initialBalance) {
    public CreateAccountRequest {
        name = name == null ? null : name.strip();
    }
}
