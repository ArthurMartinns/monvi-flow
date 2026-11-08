# MonviFlow

Aplicação de finanças pessoais para acompanhar contas, lançamentos e orçamentos. Projeto de portfólio desenvolvido com **Java 21, Spring Boot, PostgreSQL, React e TypeScript**.

## Funcionalidades

- Cadastro e acesso com autenticação por sessão; edição do perfil e troca de senha.
- Contas com saldo inicial e saldo calculado a partir dos lançamentos.
- Receitas e despesas com categorias, edição, exclusão, filtros, paginação e exportação CSV.
- Visão geral com gráficos, histórico, saldo por conta e filtros por mês e conta.
- Orçamentos mensais por categoria com alertas de limite.
- Bot do Telegram para consultar saldos, lançamentos recentes e resumo do mês, além de registrar receitas e despesas.

Os filtros da aplicação web ficam na URL, permitindo compartilhar ou retomar uma consulta.

## Executar localmente

Requisitos: **Java 21**, **Node.js 24 com npm** e **Docker com Docker Compose**.

1. Na raiz do projeto, copie `.env.example` para `.env`, escolha uma senha em `POSTGRES_PASSWORD` e inicie o PostgreSQL:

   ```powershell
   Copy-Item .env.example .env
   docker compose up -d postgres
   ```

2. Em outro terminal, inicie o backend com a mesma senha definida no `.env`:

   ```powershell
   cd backend
   $env:POSTGRES_PASSWORD = "SUA_SENHA_LOCAL"
   .\mvnw.cmd spring-boot:run
   ```

3. Em outro terminal, inicie o frontend:

   ```powershell
   cd frontend
   npm.cmd ci
   npm.cmd run dev
   ```

Acesse **http://127.0.0.1:5173**. A API usa a porta **8080** e o PostgreSQL local usa a porta **5434**. Para testar a aplicação, crie uma conta pela tela de cadastro e adicione contas, categorias e lançamentos.

### Bot do Telegram (opcional)

O bot fica desativado por padrão. Para ativá-lo, defina `TELEGRAM_ENABLED=true`, `TELEGRAM_BOT_TOKEN` e `TELEGRAM_BOT_USERNAME` no ambiente do backend antes de iniciá-lo. O token deve permanecer privado.

Na aplicação, abra **Configurações → Telegram**, gere um código e envie `/vincular CÓDIGO` em uma conversa privada com o bot. O código expira em 10 minutos. Use `/contas` e `/categorias` para consultar os IDs necessários aos lançamentos.

| Comando | Função |
| --- | --- |
| `/saldo` | Saldo total e por conta. |
| `/ultimos` | Cinco lançamentos mais recentes. |
| `/resumo` | Receitas, despesas e resultado do mês atual. |
| `/despesa 25,90 27 64 Cinema` | Registra uma despesa: valor, ID da conta, ID da categoria e descrição. |
| `/receita 100,00 27 60 Salário` | Registra uma receita no mesmo formato. |

Os lançamentos feitos pelo bot usam a data atual no fuso de São Paulo. Para revogar o acesso, use **Desvincular** em Configurações.

## Verificações

Com o Docker em execução, rode os testes de integração do backend:

```powershell
cd backend
.\mvnw.cmd test
```

No frontend, verifique a compilação e o código:

```powershell
cd frontend
npm.cmd run build
npm.cmd run lint
```

## Limites atuais

Os valores são em reais (BRL). Os lançamentos têm data sem horário e não aceitam datas futuras. Contas e categorias usadas por lançamentos não podem ser excluídas. O e-mail de acesso não pode ser alterado pela interface.
