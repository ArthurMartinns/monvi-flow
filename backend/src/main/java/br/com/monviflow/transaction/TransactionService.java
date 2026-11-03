package br.com.monviflow.transaction;

import br.com.monviflow.account.AccountRepository;
import br.com.monviflow.category.CategoryRepository;
import br.com.monviflow.user.UserRepository;
import java.util.List;
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

    private Long userId(String email) {
        return users.findByEmail(email).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.UNAUTHORIZED)).getId();
    }
}
