package br.com.monviflow.telegram;

import br.com.monviflow.account.AccountRepository;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
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
    private final ObjectMapper json;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    private final String baseUrl;
    private long offset;

    public TelegramBot(TelegramLinkService links, AccountRepository accounts, ObjectMapper json,
            @Value("${telegram.bot-token:}") String token) {
        if (token.isBlank())
            throw new IllegalStateException("TELEGRAM_BOT_TOKEN is required when Telegram is enabled");
        this.links = links;
        this.accounts = accounts;
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
                offset = Math.max(offset, update.path("update_id").asLong() + 1);
                try {
                    onUpdate(update);
                } catch (Exception exception) {
                    log.warn("Could not handle Telegram update: {}", exception.getClass().getSimpleName());
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
        } else if (text.startsWith("/vincular ")) {
            String code = text.substring("/vincular ".length()).trim();
            send(chatId, links.link(code, senderId)
                    ? "Conta vinculada. Envie /saldo para consultar seus saldos."
                    : "Código inválido ou expirado. Gere outro nas Configurações do MonviFlow.");
        } else if (text.equals("/start") || text.equals("/vincular")) {
            send(chatId,
                    "Abra Configurações no MonviFlow, gere um código e envie /vincular CÓDIGO aqui. Depois use /saldo.");
        } else if (text.startsWith("/")) {
            send(chatId, "Comandos disponíveis: /saldo e /vincular CÓDIGO.");
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
