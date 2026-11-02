package br.com.monviflow.category;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CategoryRepository extends JpaRepository<Category, Long> {
    List<Category> findAllByUserIdOrderByIdAsc(Long userId);
}
