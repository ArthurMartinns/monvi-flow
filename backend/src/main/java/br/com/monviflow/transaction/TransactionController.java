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

    @GetMapping("/search")
    public TransactionPage search(Authentication auth, @Valid @ModelAttribute TransactionFilter filter) {
        return service.search(auth.getName(), filter);
    }

    @PutMapping("/{id}")
    public TransactionResponse update(Authentication auth, @PathVariable Long id,
            @Valid @RequestBody CreateTransactionRequest request) {
        return service.update(auth.getName(), id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(Authentication auth, @PathVariable Long id) {
        service.delete(auth.getName(), id);
    }
}
