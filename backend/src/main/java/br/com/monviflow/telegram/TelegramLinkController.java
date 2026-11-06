package br.com.monviflow.telegram;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/telegram/link")
public class TelegramLinkController {
    private final TelegramLinkService links;

    public TelegramLinkController(TelegramLinkService links) {
        this.links = links;
    }

    @GetMapping
    public TelegramLinkService.LinkStatus status(Authentication auth) {
        return links.status(auth.getName());
    }

    @PostMapping("/code")
    public TelegramLinkService.LinkCode createCode(Authentication auth) {
        return links.createCode(auth.getName());
    }

    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void unlink(Authentication auth) {
        links.unlink(auth.getName());
    }
}
