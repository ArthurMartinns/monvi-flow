package br.com.monviflow.account;

import java.math.RoundingMode;

public record AccountResponse(Long id, String name, String initialBalance, String currentBalance) {

    public static AccountResponse from(Account account) {
        String balance = account.getInitialBalance().setScale(2, RoundingMode.UNNECESSARY).toPlainString();
        return new AccountResponse(account.getId(), account.getName(), balance, balance);
    }
}
