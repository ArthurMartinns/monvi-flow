package br.com.monviflow.account;

import br.com.monviflow.user.UserRepository;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional(readOnly = true)
public class AccountService {

    private final AccountRepository accounts;
    private final UserRepository users;

    public AccountService(AccountRepository accounts, UserRepository users) {
        this.accounts = accounts;
        this.users = users;
    }

    @Transactional
    public AccountResponse create(String email, CreateAccountRequest request) {
        return AccountResponse.from(accounts.save(
                new Account(userId(email), request.name(), request.initialBalance())));
    }

    public List<AccountResponse> list(String email) {
        return accounts.findAllByUserIdOrderByIdAsc(userId(email))
                .stream().map(AccountResponse::from).toList();
    }

    private Long userId(String email) {
        return users.findByEmail(email).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.UNAUTHORIZED)).getId();
    }
}
