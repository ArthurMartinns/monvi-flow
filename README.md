# MonviFlow

Gerenciador de finanças pessoais em desenvolvimento, com backend em Java e Spring Boot,
frontend em React e TypeScript e banco PostgreSQL.

Atualmente possui cadastro, login e logout com autenticação por sessão.

## Requisitos

- Java 21
- Node.js 24 e npm
- Docker com Docker Compose

## Executar localmente

Na raiz do projeto, copie `.env.example` para `.env`, defina `POSTGRES_PASSWORD` e inicie o banco:

```cmd
copy .env.example .env
docker compose up -d postgres
```

Em um terminal CMD, inicie o backend usando a mesma senha do `.env`:

```cmd
cd backend
set "POSTGRES_PASSWORD=SUA_SENHA_LOCAL"
mvnw.cmd spring-boot:run
```

Em outro terminal, inicie o frontend:

```cmd
cd frontend
npm ci
npm run dev
```

Acesse http://127.0.0.1:5173. O backend roda na porta 8080.
