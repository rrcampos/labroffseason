# LBR Offseason Hub

Hub editorial offseason Lakers Brasil 2026 (jun-out). Painel compartilhado pra equipe (Renato, Paola, Leticia) acompanhar pillars, notícias timing, rumores reportados, análises e KPIs do plano editorial.

## Stack

- **Backend**: Node.js + Hono (servidor + API)
- **Frontend**: HTML + CSS + JS vanilla (sem build step)
- **Persistência**: JSON em volume Railway
- **Auth**: senha simples via env var

## Rodar localmente

```bash
# Instalar deps
npm install

# Copiar env example
cp .env.example .env
# Edita .env e troca EDIT_PASSWORD por uma senha real

# Rodar dev (autoreload)
npm run dev
# OU produção
npm start
```

Abre em `http://localhost:3000`.

A primeira execução copia `src/data/initial.json` pra `./data/state.json` (que é o arquivo vivo, gitignorado).

## Estrutura

```
lbr-offseason-hub/
├── package.json
├── railway.json
├── .env.example          # senha + caminho do JSON
├── .gitignore            # ignora data/, node_modules, .env
├── README.md
├── src/
│   ├── server.js         # Hono backend (GET/POST /api/data, /api/login, /api/health)
│   ├── data/
│   │   └── initial.json  # estado inicial (versionado no Git)
│   └── public/
│       ├── index.html    # estrutura do hub
│       ├── styles.css    # dark theme Design Ideal + chartreuse
│       └── app.js        # lógica reativa, fetch, edit/save
└── data/                 # volume persistente (gitignorado)
    └── state.json        # estado vivo da equipe
```

## Deploy no Railway

### 1. Criar repo no GitHub

```bash
cd C:\Users\renat\lbr-offseason-hub
git init
git add .
git commit -m "feat: hub editorial offseason Lakers Brasil 2026"
gh repo create lbr-offseason-hub --private --source=. --remote=origin --push
```

(Se não tiver `gh` CLI, cria o repo manualmente em github.com e dá `git remote add origin ...` + `git push`.)

### 2. Criar projeto no Railway

1. Acessa railway.app, login com GitHub.
2. **New Project** → **Deploy from GitHub repo** → seleciona `lbr-offseason-hub`.
3. Railway detecta Node automaticamente. Build com Nixpacks (`railway.json` já configurado).

### 3. Configurar volume persistente

1. No projeto Railway, vai em **Settings** do serviço.
2. **Volumes** → **+ New Volume**.
3. Mount path: `/data`
4. Size: 1GB (mais que suficiente).

### 4. Variáveis de ambiente

No Railway, **Variables**:

- `EDIT_PASSWORD` = senha que a equipe vai usar pra editar (escolhe uma forte; compartilha por canal seguro)
- `DATA_FILE` = `/data/state.json` (caminho dentro do volume)
- `PORT` = (Railway define automaticamente, não precisa setar)

### 5. Domínio

1. **Settings** → **Networking** → **Generate Domain** (gera um `*.up.railway.app`).
2. Ou conecta domínio próprio (ex: `offseason.lakersbrasil.com`) via CNAME.

### 6. Compartilhar com a equipe

- URL pública: o domínio gerado pelo Railway
- Senha de edição: compartilha via WhatsApp/Notion/canal seguro com Paola e Leticia
- Eles abrem a URL, clicam em **Entrar**, colam a senha → ficam habilitados pra editar

## Como a equipe usa

### Modo visualização (sem senha)
- Vê todo o plano: pillars, calendário, backlog, rumores, KPIs, descartes
- Não consegue editar nem salvar

### Modo edição (com senha)
- Botão **Entrar** no topo → cola senha
- Todos os inputs ficam habilitados
- Edita inline: status, owner, URL publicada, métricas, notas
- Adiciona rumor por mês: clica em **+ Adicionar rumor** na coluna do mês
- Atualiza KPIs reais nas tabelas do mês fechado
- Indicador no topo mostra estado: Modo visualização / Pronto pra editar / Mudanças não salvas / Salvando / Salvo
- **Ctrl+S** salva
- Botão **Salvar** salva
- Botão **Export** baixa JSON de backup

### Fluxo recomendado de update
1. Equipe edita conforme avança (status de pillars, owner de notícias)
2. Renato consolida no fim do dia (revisa, ajusta se preciso, salva)
3. KPIs reais (cliques, CTR) entram no fechamento do mês

## Segurança

- Auth é uma senha simples compartilhada (não tem usuários individuais). Suficiente pro escopo (equipe pequena, dados não sensíveis).
- Se quiser mais robusto: trocar pra magic links via email, ou OAuth com GitHub/Google.
- O volume Railway persiste entre deploys, mas **faz backup periódico** via botão Export ou via API:
  ```bash
  curl https://seu-dominio.up.railway.app/api/data > backup-AAAA-MM-DD.json
  ```

## Backups manuais

A cada update grande, o backend já salva um `state.json.bak` antes de sobrescrever. Mas pra rollback além disso, baixa via Export periodicamente.

## API

- `GET /api/health` — healthcheck
- `GET /api/data` — retorna estado completo (público)
- `POST /api/login` — body `{ password }` → retorna `{ ok, token }` se senha correta
- `POST /api/data` — body é o estado completo, header `Authorization: Bearer <token>` → salva no volume

## Customizações futuras (backlog)

- [ ] Histórico de mudanças (quem mudou o quê, quando) via auto-commit Git
- [ ] Webhook pra notificar Slack/WhatsApp em mudanças
- [ ] Gráfico de performance dos pillars (Chart.js) na visão geral
- [ ] Botão "preencher KPI do mês" que puxa do GSC via API
- [ ] Usuários individuais (Paola, Leticia, Renato) em vez de senha única
- [ ] Vinculação direta com tasks Asana do Lakers Brasil

## Referências

- Documento mestre do plano: `C:\Users\renat\OneDrive\Desktop\LBR_PlanoOffseason_DI_28-05-26.md`
- Memória editorial: `reference_lakers_brasil_content_scope.md`
- Convenções editoriais: `reference_lakers_brasil_editorial_conventions.md`
- Análises que originaram o plano: Asana tasks 17 (LeBron R$50M D+7), 18 (LeBron Clippers D+14), 14 (GSC mensal) — 28/05/26

---

Hub criado em 28/05/26 · Design Ideal · Lakers Brasil
