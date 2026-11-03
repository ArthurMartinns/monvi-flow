package br.com.monviflow.category;

import java.util.List;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/categories")
public class CategoryController {

    private final CategoryService service;

    public CategoryController(CategoryService service) {
        this.service = service;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CategoryResponse create(Authentication auth, @Valid @RequestBody CreateCategoryRequest request) {
        return service.create(auth.getName(), request);
    }

    @GetMapping
    public List<CategoryResponse> list(Authentication auth) {
        return service.list(auth.getName());
    }

    @PatchMapping("/{id}")
    public CategoryResponse rename(Authentication auth, @PathVariable Long id,
            @Valid @RequestBody RenameCategoryRequest request) {
        return service.rename(auth.getName(), id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(Authentication auth, @PathVariable Long id) {
        service.delete(auth.getName(), id);
    }
}
