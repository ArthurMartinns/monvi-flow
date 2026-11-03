package br.com.monviflow.transaction;

import br.com.monviflow.account.Account;
import br.com.monviflow.category.Category;
import java.math.BigDecimal;
import java.time.LocalDate;
import jakarta.persistence.*;

@Entity
@Table(name = "financial_transaction")
public class Transaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private Long userId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "account_id", nullable = false)
    private Account account;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "category_id", nullable = false)
    private Category category;

    @Column(nullable = false, length = 255)
    private String description;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal amount;

    @Column(nullable = false)
    private LocalDate date;

    protected Transaction() {
    }

    public Transaction(Long userId, Account account, Category category, CreateTransactionRequest request) {
        this.userId = userId;
        update(account, category, request);
    }

    public void update(Account account, Category category, CreateTransactionRequest request) {
        this.account = account;
        this.category = category;
        this.description = request.description();
        this.amount = request.amount();
        this.date = request.date();
    }

    public Long getId() {
        return id;
    }

    public Account getAccount() {
        return account;
    }

    public Category getCategory() {
        return category;
    }

    public String getDescription() {
        return description;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public LocalDate getDate() {
        return date;
    }
}
