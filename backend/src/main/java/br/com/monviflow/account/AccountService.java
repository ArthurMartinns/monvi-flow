package br.com.monviflow.account;

import br.com.monviflow.user.UserRepository;
import java.util.List;
import org.hibernate.exception.ConstraintViolationException;
import org.springframework.dao.DataIntegrityViolationException;
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
        return accounts.findSummaries(userId(email), null)
                .stream().map(AccountResponse::from).toList();
    }

    @Transactional
    public AccountResponse rename(String email, Long id, RenameAccountRequest request) {
        Account account = find(email, id);
        account.rename(request.name());
        accounts.flush();
        return AccountResponse.from(accounts.findSummaries(userId(email), id).getFirst());
    }

    @Transactional
    public void delete(String email, Long id) {
        Account account = find(email, id);
        try {
            accounts.delete(account);
            accounts.flush();
        } catch (DataIntegrityViolationException exception) {
            for (Throwable cause = exception; cause != null; cause = cause.getCause()) {
                if (cause instanceof ConstraintViolationException violation
                        && "23503".equals(violation.getSQLState())) {
                    throw new AccountInUseException();
                }
            }
            throw exception;
        }
    }

    private Account find(String email, Long id) {
        return accounts.findByIdAndUserId(id, userId(email))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }

    private Long userId(String email) {
        return users.findByEmail(email).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.UNAUTHORIZED)).getId();
    }
}
