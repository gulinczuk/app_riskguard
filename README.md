# Riskguard — App do cliente (cadastro + mapa + painel de risco)

App web (React + Vite + TypeScript) para o segurado acompanhar seus
equipamentos: cadastro de fazenda/equipamento, mapa em tempo real, painel
de risco explicável, histórico auditável e alerta de antifurto.

## Stack

- React 19 + Vite + TypeScript
- Supabase JS (auth + queries, sempre com a chave `anon`/`publishable` — RLS
  faz a filtragem por cliente)
- React Router
- Leaflet / react-leaflet para o mapa
- Tailwind CSS v4

## Antes de rodar

**1. Rode as migrations que faltam no Supabase.**

Duas migrations pendentes — abra o SQL Editor do seu projeto Supabase e
rode o conteúdo de cada uma:

- `supabase_missing_rpc.sql` — cria a função RPC
  `resolve_theft_event(event_id, resolved_by)`, usada pelo botão "marcar
  como resolvido", e adiciona a coluna `resolved_by` em `theft_events`.
  A função checa se quem está chamando é da equipe da seguradora
  (`is_sompo_staff`) ou dono do device antes de resolver — ajuste essa
  regra se sua policy de RLS for diferente.

- `supabase_roles_and_invites.sql` — adiciona a coluna `role`
  (`'gestor'|'operador'`) em `client_users`, cria a tabela `invites` e as
  funções RPC `create_invite()` / `accept_invite(p_code)` usadas pelo
  fluxo de convite (ver seção "Papéis e convites" abaixo).

**2. Configure as variáveis de ambiente.**

```bash
cp .env.example .env
```

Edite `.env` com a URL do seu projeto e a chave `anon`/`publishable`
(NUNCA a `service_role`/`secret` — essa é só para backend/dispositivo):


**3. Crie pelo menos um usuário.**

Basta criar uma conta normalmente pela tela de login (e-mail ou Google) —
o primeiro cadastro sem convite vira automaticamente `role='gestor'` de
uma empresa nova em `client_users`. Não precisa mais inserir a linha
manualmente no painel do Supabase.

## Rodando localmente

```bash
npm install
npm run dev
```

Abre em `http://localhost:5173`.

## Build de produção

```bash
npm run build
npm run preview   # serve o build localmente pra conferir
```

O resultado fica em `dist/` — pode subir em qualquer hosting estático
(Vercel, Netlify, Cloudflare Pages etc.), só configurando as mesmas
variáveis de ambiente lá.

## Papéis e convites

Cada usuário em `client_users` tem um `role`: `gestor` ou `operador`.

- **Criar empresa** (cadastro normal, sem convite): o usuário vira
  `gestor` de um `client_id` novo. É o fluxo padrão de quem se cadastra
  direto pela tela de login.
- **Entrar via convite**: o gestor gera um link em "Convidar operador"
  (botão no cabeçalho, visível só pra quem é `gestor`). O link tem o
  formato `/convite/CODIGO` e aponta pra um registro na tabela `invites`
  — de uso único e com expiração de 7 dias. Quem se cadastra (ou loga,
  se já tiver conta) por esse link vira `operador` do mesmo `client_id`
  do gestor que gerou o convite, em vez de ganhar uma empresa nova.
- Login com Google funciona nos dois fluxos — o código do convite
  viaja junto no redirect (`/convite/CODIGO`) pra não se perder.
- Depois do login, o app redireciona: `gestor` vai pras telas normais
  (mapa, fazendas, equipamentos, geofences) e `operador` vai pra
  `/operador` — cada um é bloqueado de acessar as rotas do outro.

A área `/operador` ainda está em construção (só uma tela placeholder por
enquanto); o conteúdo de verdade vem numa etapa futura.

## Estrutura


## O que ficou como decisão de projeto (avise se quiser mudar)

- **Mapa**: busca a telemetria mais recente de cada equipamento ativo a
  cada 15s (polling), não websocket/realtime do Supabase — mais simples
  pro MVP. Se quiser latência menor, dá pra trocar por
  `supabase.channel(...).on('postgres_changes', ...)`.
- **Cor do marcador no mapa**: vem da categoria do `risk_scores` mais
  recente do equipamento (verde/amarelo/vermelho).
- **`factors` (jsonb)**: o componente aceita tanto um objeto
  `{ "chave": peso }` quanto um array `[{ "label": ..., "weight": ... }]`.
  Ajuste `FactorsBar.tsx` se o formato real que a IA grava for diferente.
- **Geofence**: só criei o formulário de círculo (como pedido no "opcional").
  Não desenhei o círculo no mapa ainda — dá pra adicionar depois com
  `<Circle>` do react-leaflet.
- **Convites**: código curto de uso único numa tabela `invites`, em vez
  de expor o `client_id` cru na URL — não vaza o UUID interno, expira,
  pode ser revogado e dá pra auditar quem convidou/aceitou.
