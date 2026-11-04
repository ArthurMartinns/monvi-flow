package br.com.monviflow.transaction;

import br.com.monviflow.account.AccountRepository;
import br.com.monviflow.category.CategoryRepository;
import br.com.monviflow.user.UserRepository;
import java.util.List;
import java.util.ArrayList;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional(readOnly = true)
public class TransactionService {

    private final TransactionRepository transactions;
    private final AccountRepository accounts;
    private final CategoryRepository categories;
    private final UserRepository users;

    public TransactionService(TransactionRepository transactions, AccountRepository accounts,
            CategoryRepository categories, UserRepository users) {
        this.transactions = transactions;
        this.accounts = accounts;
        this.categories = categories;
        this.users = users;
    }

    @Transactional
    public TransactionResponse create(String email, CreateTransactionRequest request) {
        Long userId = userId(email);
        var account = accounts.findByIdAndUserId(request.accountId(), userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        var category = categories.findByIdAndUserId(request.categoryId(), userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        return TransactionResponse.from(transactions.save(new Transaction(userId, account, category, request)));
    }

    public List<TransactionResponse> list(String email) {
        return transactions.findAllByUserIdOrderByDateDescIdDesc(userId(email))
                .stream().map(TransactionResponse::from).toList();
    }

    public TransactionPage search(String email, TransactionFilter filter) {
        Long userId = userId(email);
        Specification<Transaction> specification = (root, query, builder) -> {
            var predicates = new ArrayList<Predicate>();
            predicates.add(builder.equal(root.get("userId"), userId));
            if (filter.from() != null) predicates.add(builder.greaterThanOrEqualTo(root.get("date"), filter.from()));
            if (filter.to() != null) predicates.add(builder.lessThanOrEqualTo(root.get("date"), filter.to()));
            if (filter.accountId() != null) predicates.add(builder.equal(root.get("account").get("id"), filter.accountId()));
            if (filter.categoryId() != null) predicates.add(builder.equal(root.get("category").get("id"), filter.categoryId()));
            if (filter.type() != null) predicates.add(builder.equal(root.get("category").get("type"), filter.type()));
            if (filter.query() != null && !filter.query().isBlank()) {
                String escaped = filter.query().toLowerCase(java.util.Locale.ROOT)
                        .replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
                predicates.add(builder.like(builder.lower(root.get("description")), "%" + escaped + "%", '\\'));
            }
            return builder.and(predicates.toArray(Predicate[]::new));
        };
        return TransactionPage.from(transactions.findAll(specification, PageRequest.of(filter.page(), filter.size(),
                Sort.by(Sort.Direction.DESC, "date", "id"))));
    }

    @Transactional
    public TransactionResponse update(String email, Long id, CreateTransactionRequest request) {
        Long userId = userId(email);
        Transaction transaction = find(id, userId);
        var account = accounts.findByIdAndUserId(request.accountId(), userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        var category = categories.findByIdAndUserId(request.categoryId(), userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        transaction.update(account, category, request);
        return TransactionResponse.from(transaction);
    }

    @Transactional
    public void delete(String email, Long id) {
        transactions.delete(find(id, userId(email)));
    }

    private Transaction find(Long id, Long userId) {
        return transactions.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }

    private Long userId(String email) {
        return users.findByEmail(email).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.UNAUTHORIZED)).getId();
    }
}
