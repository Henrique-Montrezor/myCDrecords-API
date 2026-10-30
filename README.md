# MyCDRecords API

A CD/album registration REST API built with **Express + TypeScript**. It lets users catalog albums, write and vote on reviews, follow other users, build custom lists/collections, and earn badges through gamification. Music metadata is powered by the **MusicBrainz** and **Spotify** APIs.

## Features

- 🔐 **Authentication** — JWT access tokens, refresh tokens, email verification, and password reset.
- 👤 **Profiles & Users** — User accounts with public profiles.
- 🛡️ **Admin** — Role-based admin actions (bans, moderation).
- 💿 **Music data** — Artist, album, and track search via MusicBrainz.
- 🎧 **Spotify integration** — Enriched album/track data from the Spotify API.
- ⭐ **Reviews & Votes** — Rate and review albums; upvote/downvote reviews.
- 🤝 **Social** — Follow/unfollow other users.
- 📋 **Lists** — Create custom collections of albums.
- 🏆 **Gamification** — Badges and achievements awarded to users.
- 🧭 **Recommendations** — Personalized suggestions.
- 🚦 **Rate limiting** — Redis-backed with an in-memory fallback.
- 📚 **API docs** — Interactive Swagger UI.

## Tech Stack

- **Runtime:** Node.js 18+
- **Language:** TypeScript
- **Framework:** Express 4
- **Database:** MySQL (via `mysql2`)
- **Cache / Rate limiting:** Redis (via `ioredis`, optional)
- **Validation:** Zod
- **Auth:** JSON Web Tokens (`jsonwebtoken`), `bcrypt`
- **Logging:** Winston + Morgan
- **Docs:** `swagger-jsdoc` + `swagger-ui-express`
- **Testing:** Jest, ts-jest, Supertest

## Prerequisites

- **Node.js** 18 or newer (and npm)
- **MySQL** server (a reachable instance for the database)
- **Redis** — optional; if `REDIS_URL` is not set, rate limiting falls back to an in-memory store
- **Docker** — optional, for containerized runs

## Installation

```bash
# 1. Clone the repository
git clone <repository-url>
cd myCDrecords-server

# 2. Install dependencies
npm install

# 3. Create your environment file from the example
Copy-Item .env.example .env
# then edit .env and fill in your own values
```

The API cannot authenticate users until `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`,
`MYSQL_PASSWORD` and `MYSQL_DATABASE` point to a reachable MySQL instance.
For local development with a self-signed certificate, keep
`MYSQL_SSL_REJECT_UNAUTHORIZED=false`. In production, provide a trusted
`MYSQL_SSL_CA` and use `MYSQL_SSL_REJECT_UNAUTHORIZED=true`.

## Environment Variables

Configure these in your `.env` file (see [.env.example](.env.example) for the full template):

| Variable | Description |
| --- | --- |
| `MYSQL_HOST` | MySQL host |
| `MYSQL_PORT` | MySQL port (e.g. `3306`) |
| `MYSQL_USER` | MySQL username |
| `MYSQL_PASSWORD` | MySQL password |
| `MYSQL_DATABASE` | Database name (e.g. `mycdrecords`) |
| `PORT` | HTTP port the server listens on (default `3004`) |
| `DOMAIN` | Base domain of the server |
| `NODE_ENV` | `development`, `production`, or `test` |
| `JWT_SECRET` | Secret for signing access tokens |
| `ADMIN_EMAILS` | Comma-separated emails granted admin role |
| `FRONTEND_URL` | Frontend origin (used for CORS and links) |
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` | Spotify API credentials |

## Running Locally

Development mode (auto-reload with nodemon):

```bash
npm run dev
```

Development mode for the API and React client together (run from this folder):

```bash
npm run all-dev
```

The API runs on `http://localhost:3004` and the client uses Vite on `http://localhost:5173` (or the next available port).

Production build and start:

```bash
npm run build   # compiles TypeScript into dist/
npm start       # runs node dist/server.js
```

On startup the app connects to MySQL and **automatically creates all required tables** (and seeds default badges). Once running:

- API base URL: `http://localhost:3004`
- Swagger docs: `http://localhost:3004/docs`

> The default port is `3004`; override it with the `PORT` variable in `.env`.

## Docker

A `Dockerfile` is provided (based on `node:18-alpine`):

```bash
# Build the image
docker build -t mycdrecords-server .

# Run the container (map the container's port 3000 to a host port)
docker run --env-file .env -p 3000:3000 mycdrecords-server
```

## Running Tests

The project uses Jest with ts-jest and Supertest (unit and integration tests under `src/tests/`).

```bash
npm test              # run the full test suite
npm run test:watch    # run tests in watch mode
npm run test:coverage # run tests with a coverage report
```

## API Overview

All routes are mounted under `/api`. Explore and try them via the Swagger UI at `/docs`.

| Base path | Description |
| --- | --- |
| `/api/auth` | Registration, login, tokens, verification, password reset |
| `/api/user` | User account management |
| `/api/profile` | User profiles |
| `/api/admin` | Admin/moderation actions |
| `/api/artist` | Artist search (MusicBrainz) |
| `/api/albuns` | Album search (MusicBrainz) |
| `/api/musics` | Track search (MusicBrainz) |
| `/api/spotify` | Spotify-enriched data |
| `/api/reviews` | Album reviews |
| `/api/social` | Follows and votes |
| `/api/lists` | Custom lists/collections |
| `/api/gamification` | Badges and achievements |
| `/api/recommendations` | Personalized recommendations |

## Curadoria do Descobrir (F8b)

Esta fatia usa exclusivamente metadados MusicBrainz e notas editoriais locais.
Não importa histórico nem conteúdo Spotify e não gera recomendações pessoais ou charts.

### Persistência

- A inicialização executa a migração aditiva e repetível em `src/mysql2/migrations/001-discovery.ts`, depois da tabela de usuários. O usuário MySQL precisa de permissão de DDL.
- `album_catalog` mantém identidade interna e unicidade por `(source, external_id)`, créditos, data/tipo, tags normalizadas, URL da fonte e `observed_at`. Não junta discos por título, edições ou IDs Spotify.
- Consultas bem-sucedidas a `GET /api/albums/discover` atualizam o lote consultado em uma escrita bulk; uma falha de persistência retorna 503, não sucesso incompleto.
- `observed_at` registra a observação local, não uma atualização confirmada no provedor. O adaptador MusicBrainz usa o cache existente de 60 segundos. Não há job agendado, importação massiva nem fan-out por card nesta fatia.
- As tabelas `discovery_selection` e `discovery_selection_items` guardam publicação, revisão, responsável, notas e ordem. A migração não apaga seleções, semeia escolhas ou concede acesso administrativo.
- A migração pode ser repetida após interrupção, pois DDL MySQL tem commit implícito. Isso não substitui um runner global versionado, backups ou plano de rollback de produção; não remover tabelas como procedimento de recuperação.

### Publicar uma seleção

Usar uma conta **já autorizada como administradora** e autenticação existente.
As rotas estão documentadas no Swagger em `/docs`; não salvar tokens nos exemplos ou no repositório.

1. Consultar o catálogo pelo Descobrir ou importar um release-group específico com `POST /api/admin/discovery/catalog/{albumId}`. O ID deve ser um MBID UUID, não um ID de edição/release nem de Spotify. A importação verifica o álbum no MusicBrainz e não o publica.
2. Ler `GET /api/albums/discover/selection` e obter a revisão atual.
3. Enviar `PUT /api/admin/discovery/selection` com a revisão lida e até **6 álbuns distintos**, em ordem, cada um com nota de **1 a 800 caracteres**. O primeiro recebe destaque. Exemplo de formato (substituir a revisão e o MBID pelos valores reais):

```json
{
  "revision": 0,
  "items": [
    {
      "albumId": "737dc6a9-b343-4084-9c0a-206d3e538abb",
      "note": "Explique o motivo desta escolha editorial."
    }
  ]
}
```

4. A resposta contém a nova `revision`. A publicação troca todos os itens numa transação: conflito ou falha não deixa seleção parcial. Em **409**, reler e reconciliar a seleção; não sobrescrever automaticamente. Em **404**, importar o álbum ausente antes de tentar novamente.
5. Para despublicar, enviar explicitamente `{ "revision": <revisão atual>, "items": [] }`. Não há periodicidade semanal automática nem painel visual administrativo nesta fatia.

Leitura pública: `{ sectionId, kind, title, source, status, revision, updatedAt, curator, items }`.
Cada item contém `{ album, note }`; os álbuns declaram `source: "musicbrainz"`.
`status` é `ready` ou `empty`; falha de banco é **503**, não uma seleção vazia falsa.
`updatedAt` é a data da publicação. O frontend exibe autoria e data, com retry independente do catálogo.
Publicação e importação exigem autenticação (401) e admin existente (403); payload inválido retorna 400, provedor indisponível 502 e armazenamento indisponível 503.

Respeitar as [licenças dos dados MusicBrainz](https://musicbrainz.org/doc/About/Data_License):
dados centrais são CC0; dados suplementares, incluindo tags, têm condições adicionais (BY-NC-SA).
Esta implementação não certifica uso comercial desses dados. Capas são do Cover Art Archive e mantêm direitos próprios; preservar atribuição e imagem intacta, com fallback para indisponibilidade.

## Listas sociais (F9)

- A inicialização executa `src/mysql2/migrations/002-list-saves.ts` após listas e itens. Migração aditiva/repetível, sem dados artificiais; requer permissão de DDL.
- `GET /api/lists/explore` exige login. Query estrita: `scope=popular|following|friends|mine|saved`, `q` com até 100 caracteres, `sort=popular|recent`, `page=1..10000`; página fixa de 20. Padrões: `popular`, busca vazia, `popular`, página 1. `following` é follow unilateral; `friends` exige reciprocidade. Somente `mine` inclui listas privadas.
- Resposta: `{ items, total, page, pageSize, totalPages, mode }`. Cada lista inclui autoria, contagem global, `is_saved`, `save_count` e até 4 prévias ordenadas. Uma consulta batch limitada constrói as prévias, sem carregar 1000 itens nem fazer HTTP por card.
- Popularidade: pessoas distintas que salvaram nos últimos **30 dias**, mínimo **3 terceiros**, sem o autor. Desempate por salvos, criação e ID decrescentes. Se o conjunto filtrado não tiver amostra, `mode=recent`, claramente identificado no client. Uma página além do fim não muda para outro conjunto. Ordenação recente: criação/ID decrescentes.
- `PUT /api/lists/{id}/saved` e `DELETE` na mesma rota são idempotentes para listas existentes. `PUT` repetido não atualiza `created_at`; não copia discos nem segue o autor. Autenticação 401; lista ausente 404; salvar privada 403; salvar a própria pública 400.
- Salvar bloqueia a lista em transação. Tornar privada atualiza visibilidade e limpa salvos na mesma transação; falha reverte ambos. Exclusão usa FK com cascade. Todas as leituras verificam a visibilidade atual e todas as respostas de listas usam `Cache-Control: no-store`; não há cache novo de prévias.
- `GET /api/lists/{id}?page=1` continua público para listas públicas e restrito ao dono para privadas. **Mudança de contrato:** retorna no máximo **24 itens**, `item_count` global, `page`, `pageSize`, `totalPages`, `username` e `is_saved`. Client migrado para paginação; consumidores externos devem iterar páginas. Ordem estável: posição (null como zero), criação e ID crescentes.
- Janela fixa de 30 dias explicitamente rotulada, sem selector de período nesta fatia. Foto/banner próprios e reordenação continuam no F10.
- As novas prévias e o detalhe no client só exibem imagens CAA/Archive.org ligadas a MBID; imagens Spotify/sem proveniência confirmada usam fallback. Não é uma certificação do legado nem permissão para reutilizar conteúdo Spotify em recomendações.

### Verificação opcional em MySQL isolado

Os testes regulares cobrem contrato HTTP, autorização, parâmetros SQL, transações e rollback com mocks. `lists-discovery.mysql.test.ts` fica **desativado por padrão** e exige um banco de teste **já provisionado e autorizado**, diferente do banco da aplicação, com nome `mycdrecords_list_tests_<sufixo>`. Ele não cria/remove bancos. Cria tabelas e substitui fixtures **somente nesse banco dedicado**; não apontar para dados reais.

```powershell
$env:LIST_DISCOVERY_MYSQL_TESTS = "true"
$env:LIST_DISCOVERY_MYSQL_DATABASE = "mycdrecords_list_tests_local"
npm test -- --runInBand src/tests/integration/lists-discovery.mysql.test.ts
Remove-Item Env:\LIST_DISCOVERY_MYSQL_TESTS
Remove-Item Env:\LIST_DISCOVERY_MYSQL_DATABASE
```

O cenário MySQL F9 cobre follow unilateral/mútuo, amostra exata, timestamps idempotentes, privacidade e 1000 itens. A execução exige autorização do operador; testes com mocks não substituem essa evidência.

## Identidade e ordem das listas (F10)

Decisões confirmadas: foto e capa próprias guardadas no **MySQL**, e numeração como **posição livre da curadoria**, não classificação. Não há drag-and-drop nem ordenação automática.

### Migração, imagens e autorização

- Inicialização aditiva/repetível `003-list-identity.ts`, após listas/itens/salvos: `lists.order_revision`, `lists.image_revision` e `list_images`. Não reescreve ordens existentes, importa imagens antigas nem semeia conteúdo. Executar a inicialização/migração de forma serial no deploy, como as demais migrações locais.
- `list_images` usa `(list_id, kind)` como chave, `MEDIUMBLOB` e FK cascade; bytes ficam no banco, não em `/uploads`, base64 de JSON, URL pública ou serviço externo. Backups e restauração do MySQL precisam incluir essa tabela. São até duas imagens, cada uma limitada a 2 MiB após processamento; monitorar crescimento do banco/backups antes de escala. Não foi provisionado storage externo.
- `PUT /api/lists/{id}/images/{kind}` recebe corpo binário JPEG/PNG/WebP; `kind=thumbnail|banner`. Apenas o dono altera ou remove. A assinatura é conferida e o **sharp** decodifica de verdade: 64–8000 pixels por lado, até 16 megapixels, imagem estática; arquivo truncado/danificado é rejeitado. Regrava JPEG sem metadados/EXIF, recortado no centro para 512×512 ou 1600×480. Dependência nova justificada pela validação de dimensões/decodificação e descarte de metadados, não pela confiança em MIME/nome.
- Limite de entrada da API **2 MiB**. O client reaproveita `prepareImage`/`ImageUpload` para aceitar origem de até 20 MB e enviar uma versão reprocessada; servidor repete a validação independentemente do client. Imagens devem ser próprias ou licenciadas para publicação; não subir/reutilizar conteúdo Spotify.
- `GET` na mesma rota entrega somente JPEG autorizado. Lista pública aceita anônimo; privada apenas o dono. A condição de visibilidade protege os bytes no SQL e é repetida a cada requisição; `no-store`/`nosniff`, sem tokens na URL. O client usa o `request` autenticado, cria URL de objeto apenas em memória e a revoga ao substituir/desmontar.
- `DELETE` na mesma rota remove a imagem (idempotente se já ausente). Upload/substituição/remoção e avanço de `image_revision` ficam numa transação com bloqueio do pai. Tornar privada muda imediatamente a autorização dos próximos downloads; excluir lista remove os bytes via FK. Como qualquer conteúdo já visto, não é possível apagar cópias que terceiros tenham baixado antes da mudança de visibilidade.
- Todos os metadados de lista incluem `has_thumbnail`, `has_banner` (0/1), `image_revision` e `order_revision`. Não incluem blobs nem caminhos de arquivo. Client normaliza os indicadores e usa fallback de capas permitidas/estado vazio na ausência de foto própria. Capa/banner é opcional e não substitui descrição, autoria ou título.
- Erros: 400 parâmetros; 401 login; 403 dono/visibilidade; 404 lista/imagem ausente; 413 vazio ou acima de 2 MiB; 415 assinatura/formato/corpo incompatível; 422 dimensões/animação/decodificação inválida. Falha de banco não vira sucesso ou imagem vazia.

### Ordem livre, revisão e páginas

`PUT /api/lists/{id}/order`:

```json
{ "revision": 3, "itemId": 42, "toPosition": 1000 }
```

- `itemId` é o ID numérico do item da lista, não o ID externo do álbum. `toPosition` é global e começa em **1**; deve estar entre 1 e a contagem atual. Resposta `{ revision, page }`, página com 24 itens.
- Comparar `revision` com `order_revision` sob `FOR UPDATE` da lista. Ordem desatualizada retorna **409** antes de alterar itens. O client preserva a ordem exibida, desabilita novas tentativas com revisão antiga e oferece atualizar; não sobrescreve silenciosamente.
- A transação lê somente IDs ordenados no servidor (não envia a lista inteira ao navegador), move um ID, normaliza `position` em base zero e grava as posições com um único `UPDATE CASE`, junto do avanço da revisão. Empates legados são resolvidos pela mesma ordem estável de criação/ID. Não duplica/remove álbuns; mover para a posição atual é no-op.
- Adicionar/remover itens também bloqueia o pai e incrementa a revisão somente em alterações reais. Inclusão sem `position` agora **acrescenta ao fim**, em vez do antigo default 0. `position` explícito em base zero continua aceito por compatibilidade; o client usa o endpoint de movimento para organizar.
- UI com modo compacto “Organizar álbuns”, acima/abaixo e posição global, alvos 44px, anúncio de sucesso, foco restaurado no item e navegação para a página de destino. Persistência pessimista: só anuncia sucesso após a API; falha não altera a ordem local. Sem promessa de movimentação otimista ou suporte a arrastar.

### Testes MySQL F10 sem outro banco

`lists-identity.mysql.test.ts` usa **somente tabelas TEMPORARY** de uma conexão exclusiva e as destrói ao fechar essa conexão. Não cria/remove banco, não altera registros/tabelas persistentes, não semeia listas na aplicação e não depende da homologação F9 acima. Exige conexão MySQL e permissão `CREATE TEMPORARY TABLES`; não trocar por tabelas persistentes para contornar falta de permissão.

```powershell
$env:LIST_IDENTITY_MYSQL_TESTS = "true"
npm test -- --runInBand src/tests/integration/lists-identity.mysql.test.ts
Remove-Item Env:\LIST_IDENTITY_MYSQL_TESTS
```

Cobre 1000 itens e unicidade, revisão obsoleta sem sobrescrita, append/remoção e upload HTTP real → sharp → MySQL → nova leitura binária autorizada, inclusive bloqueio anônimo/terceiros e substituição/remoção. Não substitui teste de concorrência em duas conexões nem um ensaio de restauração de backup/produção.

## Project Structure

```
src/
  app.ts             # Express app setup, middleware, route mounting, DB init
  server.ts          # HTTP server bootstrap
  docs/              # Swagger configuration
  middlewares/       # Auth and error-handling middleware
  modules/           # Feature modules (auth, user, profile, albuns)
  mysql2/            # Database connection and table creation
  tests/             # Unit and integration tests
  utils/             # Logger, cache, rate limiter, Redis client, helpers
```

## License

This project is licensed under the [MIT License](LICENSE).

## Author

Henrique Montrezor
