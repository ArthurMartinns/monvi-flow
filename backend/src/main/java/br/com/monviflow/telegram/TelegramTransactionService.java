package br.com.monviflow.telegram;

import br.com.monviflow.transaction.CreateTransactionRequest;
import br.com.monviflow.transaction.TransactionResponse;
import br.com.monviflow.transaction.TransactionService;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TelegramTransactionService {
    private final JdbcTemplate jdbc;
    private final TransactionService transactions;

    public TelegramTransactionService(JdbcTemplate jdbc, TransactionService transactions) {
        this.jdbc = jdbc;
        this.transactions = transactions;
    }

    @Transactional
    public Optional<TransactionResponse> createOnce(long updateId, long userId, CreateTransactionRequest request) {
        if (updateId <= 0)
            throw new IllegalArgumentException("ID da atualização do Telegram inválido");
        int inserted = jdbc.update("""
                INSERT INTO telegram_processed_transaction (update_id, user_id)
                VALUES (?, ?) ON CONFLICT (update_id) DO NOTHING
                """, updateId, userId);
        if (inserted == 0)
            return Optional.empty();
        return Optional.of(transactions.createForUser(userId, request));
    }
}
