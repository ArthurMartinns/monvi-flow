package br.com.monviflow.account;

import java.util.List;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/accounts")
public class AccountController {

    private final AccountService service;

    public AccountController(AccountService service) {
        this.service = service;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public AccountResponse create(Authentication auth, @Valid @RequestBody CreateAccountRequest request) {
        return service.create(auth.getName(), request);
    }

    @GetMapping
    public List<AccountResponse> list(Authentication auth) {
        return service.list(auth.getName());
    }

    @PatchMapping("/{id}")
    public AccountResponse rename(Authentication auth, @PathVariable Long id,
            @Valid @RequestBody RenameAccountRequest request) {
        return service.rename(auth.getName(), id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(Authentication auth, @PathVariable Long id) {
        service.delete(auth.getName(), id);
    }
}
