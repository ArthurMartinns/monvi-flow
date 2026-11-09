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

Para usar outro banco no desenvolvimento, configure `POSTGRES_URL` (URL JDBC) e `POSTGRES_USER` no ambiente do backend, além de `POSTGRES_PASSWORD`.

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

## Deploy no Render e na Vercel

1. **PostgreSQL no Render.** Crie um banco PostgreSQL na mesma conta e região do futuro serviço web. Na página do banco, abra **Connect → Internal** e copie host, porta, nome do banco e credenciais. Desative o acesso externo ao banco se ele só for usado pelo backend.
2. **Backend no Render.** Crie um **Web Service** a partir deste repositório e selecione uma branch que contenha o Dockerfile. Use o runtime **Docker**, **Root Directory** `backend` e **Dockerfile Path** `./Dockerfile`, relativo à raiz do serviço. Use `.` como contexto do Docker se o painel pedir esse campo. Configure **Health Check Path** como `/actuator/health` e adicione as variáveis abaixo em **Environment**.

   | Variável | Valor |
   | --- | --- |
   | `SPRING_PROFILES_ACTIVE` | `prod` |
   | `POSTGRES_URL` | `jdbc:postgresql://<host-interno>:5432/<nome-do-banco>`, substituindo host, porta se diferente e nome pelos dados reais. |
   | `POSTGRES_USER` | Usuário mostrado na conexão interna. |
   | `POSTGRES_PASSWORD` | Senha mostrada na conexão interna. |

   O Render fornece `PORT`. O Flyway aplica as migrações ao iniciar. Antes de publicar o frontend, confirme que `GET /actuator/health` na URL HTTPS do serviço retorna `200` com o campo `status` igual a `UP`. Guarde as credenciais somente no backend.

3. **Frontend na Vercel.** No projeto existente, confira **Root Directory** `frontend`, preset **Vite**, Node.js `24.x`, build `npm run build` e saída `dist`. Em **Settings → Environment Variables**, adicione `MONVIFLOW_BACKEND_URL` no ambiente **Production** com a URL HTTPS real do serviço web que o Render publicou. Use só a origem, sem `/api` nem outro caminho. A Vercel lê `frontend/vercel.ts` para encaminhar `/api/*` ao Render. A configuração exige a variável em cada ambiente Vercel que fizer deploy. Para usar **Preview**, configure a origem de um backend de teste nesse ambiente. Depois que a configuração estiver na branch de produção, faça um novo deploy.
4. **Verificação.** Na URL da Vercel, `GET /api/auth/me` deve retornar `401` sem sessão e a página deve mostrar o login. Confira que `GET /api/auth/csrf` retorna `200` e que o `Set-Cookie` de `JSESSIONID` traz `Secure`, `HttpOnly` e `SameSite=Lax`. Cadastre uma conta de teste, faça login, atualize a página, crie um lançamento de teste e saia. Confira `200` em `/api/auth/me` após o login, `401` após sair e `403` em um `POST /api/auth/login` sem token CSRF.

O navegador usa o mesmo domínio da Vercel para a página e a API. Mantenha uma instância do backend enquanto as sessões estiverem em memória. Reinícios do serviço exigem novo login.

### Backups para dados pessoais

Use um PostgreSQL persistente com recuperação habilitada antes de cadastrar dados reais. O PostgreSQL gratuito do Render expira em 30 dias e não oferece backups gerenciados. Ele serve apenas para testes com dados fictícios. Confira a janela de recuperação do plano escolhido, mantenha cópias criptografadas em local separado e teste a restauração em um banco isolado. Se quiser levar dados locais para produção, faça e valide um backup antes da migração. O Flyway prepara o esquema, sem importar os seus dados locais. Consulte a [documentação de recuperação e backups do Render](https://render.com/docs/postgresql-backups).

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
