# MonviFlow

Gerenciador de finanças pessoais em desenvolvimento, com backend em Java e Spring Boot,
frontend em React e TypeScript e banco PostgreSQL.

## Funcionalidades

- Cadastro, login e logout com autenticação por sessão.
- Contas com saldo inicial e saldo atual, incluindo valores negativos.
- Categorias de receita/despesa, com categorias iniciais no cadastro.
- Movimentações com edição, exclusão, paginação, filtros e exportação CSV.
- Visão geral com filtros por conta e mês, gráficos diário/mensal e últimos lançamentos.
- Orçamentos mensais por categoria e alertas de limite.
- Configurações com dados da conta e alteração do nome.

Os filtros ficam na URL, permitindo atualizar a página, favoritar uma consulta e usar voltar/avançar
sem perder o contexto. Os orçamentos consideram todas as contas do usuário.

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

## Verificações

Com o Docker aberto, execute na pasta `backend`:

```cmd
mvnw.cmd test
```

Na pasta `frontend`:

```cmd
npm run build
npm run lint
```

## Demonstração local

Com o backend iniciado, execute na raiz:

```cmd
powershell -ExecutionPolicy Bypass -File scripts/seed-demo.ps1
```

O script aceita somente um backend local e usa uma conta fictícia separada: `demo@monviflow.local`,
senha `DemoLocal123!`. Cria três contas, movimentações do mês atual e anterior e dois orçamentos.
Executá-lo novamente no mesmo mês não duplica os lançamentos de demonstração.

Para apresentar: entre com a conta demo, alterne os gráficos diário/mensal, selecione uma conta,
abra uma categoria para conferir as movimentações filtradas e exporte o CSV. Edite um lançamento
e retorne à visão geral para conferir os novos valores. Em Configurações, altere o nome e confira o menu.

## Escopo da versão web

Valores apenas em BRL, datas de movimentação sem horário e sem lançamentos futuros. O saldo é calculado
a partir do saldo inicial e dos lançamentos. Contas e categorias com registros vinculados não podem
ser excluídas. Nesta versão, Configurações permite alterar o nome; o e-mail de acesso permanece fixo.
