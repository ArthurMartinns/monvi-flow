package br.com.monviflow.user;

public class EmailAlreadyRegisteredException extends RuntimeException {

    public EmailAlreadyRegisteredException() {
        super("E-mail já cadastrado.");
    }
}