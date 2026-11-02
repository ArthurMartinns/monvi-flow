package br.com.monviflow.category;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateCategoryRequest(
        @NotBlank @Size(max = 100) String name,
        @NotNull CategoryType type) {
    public CreateCategoryRequest {
        name = name == null ? null : name.strip();
    }
}
