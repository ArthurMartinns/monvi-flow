package br.com.monviflow.category;

import com.fasterxml.jackson.annotation.JsonCreator;

public enum CategoryType {
    INCOME, EXPENSE;

    @JsonCreator
    public static CategoryType from(String value) {
        return valueOf(value);
    }
}
