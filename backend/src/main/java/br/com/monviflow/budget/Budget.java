package br.com.monviflow.budget;

import java.math.BigDecimal;
import java.time.LocalDate;
import jakarta.persistence.*;

@Entity
@Table(name = "budget")
public class Budget {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private Long userId;

    @Column(name = "category_id", nullable = false, updatable = false)
    private Long categoryId;

    @Column(nullable = false, updatable = false)
    private LocalDate month;

    @Column(name = "limit_amount", nullable = false, precision = 19, scale = 2)
    private BigDecimal limitAmount;

    protected Budget() {
    }
}
