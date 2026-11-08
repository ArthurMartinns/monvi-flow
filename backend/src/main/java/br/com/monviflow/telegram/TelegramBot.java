package br.com.monviflow.telegram;

import br.com.monviflow.account.AccountRepository;
import br.com.monviflow.category.CategoryRepository;
import br.com.monviflow.transaction.CreateTransactionRequest;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.YearMonth;
import java.text.NumberFormat;
import java.util.Locale;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@EnableScheduling
@ConditionalOnProperty(name = "telegram.enabled", havingValue = "true")
public class TelegramBot {
    private static final Logger log = LoggerFactory.getLogger(TelegramBot.class);
    private final TelegramLinkService links;
    private final AccountRepository accounts;
    private final CategoryRepository categories;
    private final TelegramTransactionService transactions;
    private final TelegramQueryService queries;
    private final ObjectMapper json;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    private final String baseUrl;
    private long offset;

    public TelegramBot(TelegramLinkService links, AccountRepository accounts, CategoryRepository categories,
            TelegramTransactionService transactions, TelegramQueryService queries, ObjectMapper json,
            @Value("${telegram.bot-token:}") String token) {
        if (token.isBlank())
            throw new IllegalStateException("TELEGRAM_BOT_TOKEN is required when Telegram is enabled");
        this.links = links;
        this.accounts = accounts;
        this.categories = categories;
        this.transactions = transactions;
        this.queries = queries;
        this.json = json;
        this.baseUrl = "https://api.telegram.org/bot" + token + "/";
    }

    @Scheduled(fixedDelay = 1000, initialDelay = 3000)
    public void poll() {
        try {
            JsonNode response = call("getUpdates", Map.of(
                    "offset", offset, "timeout", 20, "allowed_updates", new String[] { "message" }));
            if (!response.path("ok").asBoolean()) {
                log.warn("Telegram getUpdates returned an error");
                return;
            }
            for (JsonNode update : response.path("result")) {
                try {
                    onUpdate(update);
                    offset = Math.max(offset, update.path("update_id").asLong() + 1);
                } catch (Exception exception) {
                    log.warn("Could not handle Telegram update: {}", exception.getClass().getSimpleName());
                    break;
                }
            }
        } catch (Exception exception) {
            log.warn("Telegram polling unavailable: {}", exception.getClass().getSimpleName());
        }
    }

    private void onUpdate(JsonNode update) throws Exception {
        JsonNode message = update.path("message");
        JsonNode chat = message.path("chat");
        if (!"private".equals(chat.path("type").asText()))
            return;
        long chatId = chat.path("id").asLong();
        long senderId = message.path("from").path("id").asLong();
        if (chatId <= 0 || senderId != chatId)
            return;
        String text = message.path("text").asText("").trim();
        if (text.equals("/saldo")) {
            sendBalance(chatId, senderId);
        } else if (text.equals("/ultimos") || text.equals("/resumo")) {
            var userId = links.userIdForTelegram(senderId);
            if (userId.isEmpty()) {
                send(chatId, "Vincule sua conta primeiro com /vincular CÓDIGO.");
            } else if (text.equals("/ultimos")) {
                send(chatId, queries.recent(userId.get()));
            } else {
                send(chatId, queries.summary(userId.get(),
                        YearMonth.now(ZoneId.of("America/Sao_Paulo"))));
            }
        } else if (text.equals("/contas") || text.equals("/categorias")) {
            sendOptions(chatId, senderId, text.equals("/contas"));
        } else if (text.matches("(?is)^/(despesa|receita)(?:\\s.*)?$")) {
            createTransaction(chatId, senderId, update.path("update_id").asLong(), text);
        } else if (text.startsWith("/vincular ")) {
            String code = text.substring("/vincular ".length()).trim();
            send(chatId, links.link(code, senderId)
                    ? "Conta vinculada. Envie /saldo para consultar seus saldos."
                    : "Código inválido ou expirado. Gere outro nas Configurações do MonviFlow.");
        } else if (text.equals("/start") || text.equals("/vincular")) {
            send(chatId,
                    "Abra Configurações no MonviFlow, gere um código e envie /vincular CÓDIGO aqui. Depois use /ajuda.");
        } else if (text.startsWith("/")) {
            send(chatId, "Comandos: /saldo, /ultimos, /resumo, /contas, /categorias, /despesa VALOR CONTA CATEGORIA DESCRIÇÃO, /receita VALOR CONTA CATEGORIA DESCRIÇÃO e /vincular CÓDIGO.");
        }
    }

    private void sendOptions(long chatId, long telegramUserId, boolean accountList) throws Exception {
        var userId = links.userIdForTelegram(telegramUserId);
        if (userId.isEmpty()) {
            send(chatId, "Vincule sua conta primeiro com /vincular CÓDIGO.");
            return;
        }
        StringBuilder message = new StringBuilder(accountList ? "Contas:\n" : "Categorias:\n");
        if (accountList) {
            for (var account : accounts.findSummaries(userId.get(), null))
                message.append(account.getId()).append(" — ").append(account.getName()).append('\n');
        } else {
            for (var category : categories.findAllByUserIdOrderByIdAsc(userId.get()))
                message.append(category.getId()).append(" — ").append(category.getName())
                        .append(category.getType() == br.com.monviflow.category.CategoryType.INCOME
                                ? " (receita)\n" : " (despesa)\n");
        }
        send(chatId, message.length() > (accountList ? 8 : 12) ? message.toString().strip()
                : "Nenhum item cadastrado. Cadastre pelo MonviFlow primeiro.");
    }

    private void createTransaction(long chatId, long telegramUserId, long updateId, String text) throws Exception {
        var userId = links.userIdForTelegram(telegramUserId);
        if (userId.isEmpty()) {
            send(chatId, "Vincule sua conta primeiro com /vincular CÓDIGO.");
            return;
        }
        try {
            var command = TelegramTransactionCommand.parse(text);
            var category = categories.findByIdAndUserId(command.categoryId(), userId.get());
            if (category.isEmpty() || category.get().getType() != command.type()) {
                send(chatId, "Categoria não encontrada ou incompatível com o tipo do lançamento. Confira /categorias.");
                return;
            }
            if (accounts.findByIdAndUserId(command.accountId(), userId.get()).isEmpty()) {
                send(chatId, "Conta não encontrada. Confira /contas.");
                return;
            }
            var result = transactions.createOnce(updateId, userId.get(), new CreateTransactionRequest(
                    command.accountId(), command.categoryId(), command.description(), command.amount(),
                    LocalDate.now(ZoneId.of("America/Sao_Paulo"))));
            if (result.isEmpty()) {
                send(chatId, "Esta mensagem já foi processada; nenhum lançamento duplicado foi criado.");
                return;
            }
            send(chatId, "Lançamento registrado (#" + result.get().id() + "): " + result.get().description() + " — "
                    + NumberFormat.getCurrencyInstance(Locale.forLanguageTag("pt-BR")).format(command.amount())
                    + " em " + result.get().accountName() + ".");
        } catch (IllegalArgumentException exception) {
            send(chatId, exception.getMessage());
        }
    }

    private void sendBalance(long chatId, long telegramUserId) throws Exception {
        var userId = links.userIdForTelegram(telegramUserId);
        if (userId.isEmpty()) {
            send(chatId,
                    "Sua conta ainda não está vinculada. Gere um código nas Configurações do MonviFlow e envie /vincular CÓDIGO.");
            return;
        }
        var summaries = accounts.findSummaries(userId.get(), null);
        if (summaries.isEmpty()) {
            send(chatId, "Você ainda não cadastrou contas no MonviFlow.");
            return;
        }
        NumberFormat money = NumberFormat.getCurrencyInstance(Locale.forLanguageTag("pt-BR"));
        BigDecimal total = summaries.stream().map(AccountRepository.Summary::getCurrentBalance)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        StringBuilder message = new StringBuilder("Saldo total: ").append(money.format(total));
        for (var account : summaries) {
            String line = "\n" + account.getName() + ": " + money.format(account.getCurrentBalance());
            if (message.length() + line.length() > 3900) {
                send(chatId, message.toString());
                message = new StringBuilder();
            }
            message.append(line);
        }
        if (!message.isEmpty())
            send(chatId, message.toString());
    }

    private void send(long chatId, String text) throws Exception {
        JsonNode response = call("sendMessage", Map.of("chat_id", chatId, "text", text));
        if (!response.path("ok").asBoolean())
            throw new IllegalStateException("Telegram sendMessage failed");
    }

    private JsonNode call(String method, Map<String, ?> body) throws Exception {
        HttpRequest request = HttpRequest.newBuilder(URI.create(baseUrl + method))
                .timeout(Duration.ofSeconds(30))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body)))
                .build();
        HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200)
            throw new IllegalStateException("Telegram HTTP " + response.statusCode());
        return json.readTree(response.body());
    }
}
