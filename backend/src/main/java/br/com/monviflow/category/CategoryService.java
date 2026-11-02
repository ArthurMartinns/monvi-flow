package br.com.monviflow.category;

import br.com.monviflow.user.UserRepository;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional(readOnly = true)
public class CategoryService {

    private final CategoryRepository categories;
    private final UserRepository users;

    public CategoryService(CategoryRepository categories, UserRepository users) {
        this.categories = categories;
        this.users = users;
    }

    @Transactional
    public CategoryResponse create(String email, CreateCategoryRequest request) {
        return CategoryResponse.from(categories.save(
                new Category(userId(email), request.name(), request.type())));
    }

    public List<CategoryResponse> list(String email) {
        return categories.findAllByUserIdOrderByIdAsc(userId(email))
                .stream().map(CategoryResponse::from).toList();
    }

    private Long userId(String email) {
        return users.findByEmail(email).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.UNAUTHORIZED)).getId();
    }
}
