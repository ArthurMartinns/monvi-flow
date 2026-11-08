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
- Alteração de senha com confirmação da senha atual.
- Consulta de saldos pelo bot do Telegram após vinculação da conta.

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

## Bot do Telegram

Na versão web, abra **Configurações → Telegram** e gere um código de vinculação. Em uma conversa privada com [@monviflowbot](https://t.me/monviflowbot), envie `/vincular CÓDIGO` usando o código exibido. Ele vale por 10 minutos e só pode ser usado uma vez.

Depois de vincular, envie `/saldo` para consultar o saldo total e o saldo de cada conta. Use `/ultimos` para ver os cinco lançamentos mais recentes ou `/resumo` para consultar receitas, despesas e resultado do mês atual (fuso de São Paulo). Para registrar uma movimentação, use um destes formatos:

```text
/despesa VALOR ID_DA_CONTA ID_DA_CATEGORIA DESCRIÇÃO
/receita VALOR ID_DA_CONTA ID_DA_CATEGORIA DESCRIÇÃO
```

Os campos são separados por espaços e devem aparecer nesta ordem:

| Campo | O que informar |
| --- | --- |
| `/despesa` ou `/receita` | Escolha `/despesa` para uma saída de dinheiro ou `/receita` para uma entrada. |
| `VALOR` | Valor positivo em reais, com até duas casas decimais. Aceita vírgula ou ponto, como `25,90`. |
| `ID_DA_CONTA` | Número da conta em que o dinheiro saiu ou entrou. Envie `/contas` ao bot para ver os IDs das suas contas. |
| `ID_DA_CATEGORIA` | Número da categoria do lançamento. Envie `/categorias` para ver os IDs e seus tipos. Use uma categoria de despesa com `/despesa` e uma de receita com `/receita`. |
| `DESCRIÇÃO` | Texto que identifica o lançamento; pode conter espaços, como `Almoço no trabalho`. |

Exemplo: se `/contas` mostrar `27 — Salário` e `/categorias` mostrar `64 — Lazer (despesa)`, envie `/despesa 25,90 27 64 Cinema`. Isso registra R$ 25,90 de despesa na conta Salário, na categoria Lazer, com a descrição Cinema. Para uma receita, se a categoria `60 — Salário (receita)` estiver disponível, envie `/receita 100,00 27 60 Teste de receita`.

O bot usa a data de hoje no fuso de São Paulo e responde com uma confirmação. Para interromper o acesso pelo Telegram, use **Desvincular** em Configurações. O bot responde apenas em conversas privadas.

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

Crie uma conta fictícia pela tela de cadastro. Use, por exemplo, o e-mail `demo@monviflow.local` e uma senha de demonstração. Depois, cadastre duas contas (como Conta corrente e Reserva), algumas categorias e movimentações nos meses atual e anterior. Crie orçamentos para duas categorias de despesa.

Para apresentar: entre com a conta demo, alterne os gráficos diário/mensal, selecione uma conta,
abra uma categoria para conferir as movimentações filtradas e exporte o CSV. Edite um lançamento
e retorne à visão geral para conferir os novos valores. Em Configurações, altere o nome, confira o menu
e experimente a alteração de senha. Os dados são gravados no banco local; para começar novamente,
apague os dados da conta pela interface ou recrie o banco de desenvolvimento.

## Escopo da versão web

Valores apenas em BRL, datas de movimentação sem horário e sem lançamentos futuros. O saldo é calculado
a partir do saldo inicial e dos lançamentos. Contas e categorias com registros vinculados não podem
ser excluídas. Em Configurações, o e-mail de acesso permanece fixo.
