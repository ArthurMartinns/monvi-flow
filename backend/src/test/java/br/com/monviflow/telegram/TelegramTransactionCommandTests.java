package br.com.monviflow.telegram;

import br.com.monviflow.category.CategoryType;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class TelegramTransactionCommandTests {
    @Test
    void parsesExpenseWithCommaAndDescription() {
        var command = TelegramTransactionCommand.parse("/despesa 25,90 1 2 Almoço no trabalho");
        assertEquals(CategoryType.EXPENSE, command.type());
        assertEquals("25.90", command.amount().toPlainString());
        assertEquals(1L, command.accountId());
        assertEquals(2L, command.categoryId());
        assertEquals("Almoço no trabalho", command.description());
    }

    @Test
    void rejectsMalformedOrExcessiveAmounts() {
        assertThrows(IllegalArgumentException.class, () -> TelegramTransactionCommand.parse("/receita 0 1 2 Salário"));
        assertThrows(IllegalArgumentException.class,
                () -> TelegramTransactionCommand.parse("/receita 1,999 1 2 Salário"));
        assertThrows(IllegalArgumentException.class, () -> TelegramTransactionCommand.parse("/receita 2 1 Salário"));
    }
}
