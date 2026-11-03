package br.com.monviflow.transaction;

import java.util.List;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/transactions")
public class TransactionController {

    private final TransactionService service;

    public TransactionController(TransactionService service) {
        this.service = service;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public TransactionResponse create(Authentication auth, @Valid @RequestBody CreateTransactionRequest request) {
        return service.create(auth.getName(), request);
    }

    @GetMapping
    public List<TransactionResponse> list(Authentication auth) {
        return service.list(auth.getName());
    }
}
