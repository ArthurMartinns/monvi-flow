package br.com.monviflow.telegram;

import br.com.monviflow.category.CategoryType;
import java.math.BigDecimal;
import java.util.regex.Pattern;

record TelegramTransactionCommand(CategoryType type, BigDecimal amount, long accountId,
        long categoryId, String description) {
    private static final Pattern FORMAT = Pattern.compile(
            "^/(despesa|receita)\\s+([0-9]+(?:[,.][0-9]{1,2})?)\\s+([1-9][0-9]*)\\s+([1-9][0-9]*)\\s+(.+)$",
            Pattern.CASE_INSENSITIVE | Pattern.DOTALL);

    static TelegramTransactionCommand parse(String text) {
        var match = FORMAT.matcher(text.trim());
        if (!match.matches())
            throw new IllegalArgumentException(
                    "Formato: /despesa VALOR CONTA CATEGORIA DESCRIÇÃO (ou /receita). Use /contas e /categorias para ver os IDs.");
        try {
            BigDecimal amount = new BigDecimal(match.group(2).replace(',', '.'));
            String description = match.group(5).strip();
            if (amount.signum() <= 0 || amount.precision() - amount.scale() > 17
                    || description.isEmpty() || description.length() > 255)
                throw new IllegalArgumentException(
                        "Valor deve ser positivo e a descrição deve ter até 255 caracteres.");
            return new TelegramTransactionCommand(
                    match.group(1).equalsIgnoreCase("receita") ? CategoryType.INCOME : CategoryType.EXPENSE,
                    amount, Long.parseLong(match.group(3)), Long.parseLong(match.group(4)), description);
        } catch (NumberFormatException exception) {
            throw new IllegalArgumentException("Valor ou ID inválido. Confira /contas e /categorias.");
        }
    }
}
