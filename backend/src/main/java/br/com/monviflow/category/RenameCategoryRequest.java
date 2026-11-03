package br.com.monviflow.category;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RenameCategoryRequest(@NotBlank @Size(max = 100) String name) {
    public RenameCategoryRequest {
        name = name == null ? null : name.strip();
    }
}
