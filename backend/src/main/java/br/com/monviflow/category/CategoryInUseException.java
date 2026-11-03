package br.com.monviflow.category;

public class CategoryInUseException extends RuntimeException {
    public CategoryInUseException() {
        super("Esta categoria possui registros vinculados e não pode ser excluída.");
    }
}
