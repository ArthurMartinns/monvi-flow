package br.com.monviflow.user;

public class InvalidCurrentPasswordException extends RuntimeException {
    public InvalidCurrentPasswordException() {
        super("A senha atual está incorreta.");
    }
}
