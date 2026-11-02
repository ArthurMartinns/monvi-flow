package br.com.monviflow.account;

public class AccountInUseException extends RuntimeException {
    public AccountInUseException() {
        super("Esta conta possui registros vinculados e não pode ser excluída.");
    }
}
