package br.com.monviflow.config;

import br.com.monviflow.user.UserRepository;
import java.util.Locale;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class SecurityConfig {

    @Bean
    public UserDetailsService userDetailsService(UserRepository repository) {
        return email -> {
            var user = repository.findByEmail(email.strip().toLowerCase(Locale.ROOT))
                .orElseThrow(() -> new UsernameNotFoundException("Credenciais inválidas"));
            return User.withUsername(user.getEmail())
                .password(user.getPasswordHash())
                .authorities("USER")
                .build();
        };
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        return http
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(HttpMethod.GET, "/api/auth/csrf").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/users", "/api/auth/login").permitAll()
                .anyRequest().authenticated())
            .requestCache(AbstractHttpConfigurer::disable)
            .formLogin(form -> form
                .loginPage("/api/auth/login")
                .loginProcessingUrl("/api/auth/login")
                .usernameParameter("email")
                .successHandler((request, response, authentication) -> response.setStatus(204))
                .failureHandler((request, response, exception) -> response.setStatus(401)))
            .logout(logout -> logout
                .logoutUrl("/api/auth/logout")
                .deleteCookies("JSESSIONID")
                .logoutSuccessHandler((request, response, authentication) -> response.setStatus(204)))
            .exceptionHandling(errors -> errors
                .authenticationEntryPoint((request, response, exception) -> response.setStatus(401))
                .accessDeniedHandler((request, response, exception) -> response.setStatus(403)))
            .build();
    }
}
