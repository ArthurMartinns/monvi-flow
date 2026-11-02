package br.com.monviflow.account;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RenameAccountRequest(@NotBlank @Size(max = 100) String name) {
    public RenameAccountRequest {
        name = name == null ? null : name.strip();
    }
}
