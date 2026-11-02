package br.com.monviflow.shared;

import br.com.monviflow.user.EmailAlreadyRegisteredException;
import br.com.monviflow.account.AccountInUseException;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(AccountInUseException.class)
    public ProblemDetail handleAccountInUse(AccountInUseException exception) {
        return problem(HttpStatus.CONFLICT, "Conta em uso", exception.getMessage());
    }

    @ExceptionHandler(EmailAlreadyRegisteredException.class)
    public ProblemDetail handleDuplicateEmail(EmailAlreadyRegisteredException exception) {
        return problem(HttpStatus.CONFLICT, "E-mail já cadastrado", exception.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ProblemDetail handleValidation(MethodArgumentNotValidException exception) {
        ProblemDetail problem = problem(HttpStatus.BAD_REQUEST,
                "Dados inválidos", "Confira os campos informados.");
        // Não incluir valores rejeitados: podem conter a senha.
        problem.setProperty("fields", exception.getBindingResult().getFieldErrors()
                .stream().map(error -> error.getField()).distinct().sorted().toList());
        return problem;
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ProblemDetail handleInvalidBody() {
        return problem(HttpStatus.BAD_REQUEST, "Corpo inválido",
                "Envie um objeto JSON válido com os campos esperados.");
    }

    @ExceptionHandler(DataAccessException.class)
    public ProblemDetail handleUnexpectedError() {
        return problem(HttpStatus.INTERNAL_SERVER_ERROR, "Erro interno",
                "Não foi possível concluir a operação.");
    }

    private ProblemDetail problem(HttpStatus status, String title, String detail) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
        problem.setTitle(title);
        return problem;
    }
}
