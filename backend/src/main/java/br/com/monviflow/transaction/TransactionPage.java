package br.com.monviflow.transaction;

import java.util.List;
import org.springframework.data.domain.Page;

public record TransactionPage(List<TransactionResponse> content, int page, int size,
        long totalElements, int totalPages) {
    public static TransactionPage from(Page<Transaction> page) {
        return new TransactionPage(page.getContent().stream().map(TransactionResponse::from).toList(),
                page.getNumber(), page.getSize(), page.getTotalElements(), page.getTotalPages());
    }
}
