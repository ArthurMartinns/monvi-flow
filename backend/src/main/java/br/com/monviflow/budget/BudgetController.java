package br.com.monviflow.budget;

import java.time.YearMonth;
import java.util.List;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/budgets")
public class BudgetController {
    private final BudgetService service;

    public BudgetController(BudgetService service) {
        this.service = service;
    }

    @GetMapping
    public List<BudgetResponse> list(Authentication auth,
            @RequestParam @DateTimeFormat(pattern = "yyyy-MM") YearMonth month) {
        return service.list(auth.getName(), month);
    }

    @PutMapping("/{categoryId}")
    public BudgetResponse save(Authentication auth, @PathVariable Long categoryId,
            @Valid @RequestBody BudgetRequest request) {
        return service.save(auth.getName(), categoryId, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(Authentication auth, @PathVariable Long id) {
        service.delete(auth.getName(), id);
    }
}
