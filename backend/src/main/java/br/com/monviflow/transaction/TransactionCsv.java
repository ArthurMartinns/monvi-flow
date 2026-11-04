package br.com.monviflow.transaction;

import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import br.com.monviflow.category.CategoryType;

public final class TransactionCsv {
    private static final Pattern FORMULA = Pattern.compile("^[\\s\\p{Z}\\p{Cf}]*[=+\\-@]");

    private TransactionCsv() {
    }

    public static String write(List<TransactionResponse> transactions) {
        StringBuilder csv = new StringBuilder("\uFEFFData;Tipo;Descricao;Conta;Categoria;Valor (R$)\r\n");
        for (var transaction : transactions) {
            csv.append(Stream.of(transaction.date().format(DateTimeFormatter.ofPattern("dd/MM/yyyy")),
                    transaction.type() == CategoryType.INCOME ? "Receita" : "Despesa",
                    transaction.description(), transaction.accountName(), transaction.categoryName(),
                    transaction.amount().replace('.', ',')).map(TransactionCsv::cell).collect(Collectors.joining(";")))
                    .append("\r\n");
        }
        return csv.toString();
    }

    private static String cell(String value) {
        if (FORMULA.matcher(value).find() || value.startsWith("\t") || value.startsWith("\r")
                || value.startsWith("\n")) {
            value = "'" + value;
        }
        return "\"" + value.replace("\"", "\"\"") + "\"";
    }
}
