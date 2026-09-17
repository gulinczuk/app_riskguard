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
Os scripts SQL ficam na pasta `supabase/`. Rode-os no SQL Editor do seu
projeto Supabase, na ordem:
- `supabase/supabase_missing_rpc.sql` — cria a função RPC
  `resolve_theft_event(event_id, resolved_by)` usada pelo botão "marcar como
  resolvido" (e a coluna `resolved_by` em `theft_events`, que faltava).
- `supabase/supabase_step2.sql` — senha de equipamento (`device_credentials`
  + `riskguard_set_device_password`/`riskguard_get_device_password_status`),
  revisão de risco (`riskguard_acknowledge_risk_score`) e mensagens
  Gestor/Operador/IA (tabela `messages` + `riskguard_mark_message_read`).
  **Já aplicado em produção** — este arquivo é só o registro histórico.

A função checa se quem está chamando é da equipe da seguradora
(`is_sompo_staff`) ou dono do device antes de resolver — ajuste essa regra
se sua policy de RLS for diferente.

**2. Configure as variáveis de ambiente.**

```bash
cp .env.example .env
```

Edite `.env` com a URL do seu projeto e a chave `anon`/`publishable`
(NUNCA a `service_role`/`secret` — essa é só para backend/dispositivo):

```
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
```

**3. Crie pelo menos um usuário e vincule em `client_users`.**
No painel do Supabase (Authentication → Users), crie um usuário de teste.
Depois insira uma linha em `client_users` ligando esse `user_id` a um
`client_id` (e `is_sompo_staff = false` para simular um cliente comum).

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

## Estrutura

```
src/
  lib/            cliente Supabase + tipos TS espelhando o schema
  contexts/       AuthContext (sessão + client_users)
  pages/
    Login.tsx
    Layout.tsx        nav principal
    Farms.tsx          cadastro/listagem de fazendas
    Devices.tsx        cadastro/listagem de equipamentos (exige fazenda)
    MapView.tsx        mapa com posição em tempo real + trilha
    DeviceDetail.tsx   painel de risco + alerta de furto + histórico
    Geofences.tsx      cadastro de áreas de risco (círculo)
  components/
    RiskBadge.tsx      badge verde/amarelo/vermelho
    FactorsBar.tsx      visualização do campo `factors` (jsonb)
```

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
