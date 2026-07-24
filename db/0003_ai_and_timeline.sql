-- =====================================================================
-- 0003: AI由来の加点 と タイムライン（活動ログ）
--   - AIがペナルティ判定したら自動で加点申請できるよう、rule_id を任意にし
--     由来(source)と根拠(ai_situation / ai_reason)を保持する
--   - events テーブルで、AI相談やルール成立などの出来事を時系列で残す
-- =====================================================================

-- 加点：AI由来を許可
alter table penalties alter column rule_id drop not null;
alter table penalties add column if not exists source       text not null default 'rule';
alter table penalties add column if not exists ai_situation text;
alter table penalties add column if not exists ai_reason    text;

alter table penalties drop constraint if exists penalties_source_check;
alter table penalties add constraint penalties_source_check
  check (source in ('rule','ai'));

-- rule由来はrule_id必須 / ai由来は状況テキスト必須、を担保
alter table penalties drop constraint if exists penalties_source_shape;
alter table penalties add constraint penalties_source_shape check (
  (source = 'rule' and rule_id is not null) or
  (source = 'ai'   and ai_situation is not null)
);

-- タイムライン（活動ログ）
create table if not exists events (
  id              uuid primary key default gen_random_uuid(),
  group_id        uuid not null references groups(id) on delete cascade,
  actor_member_id uuid references members(id) on delete set null,
  type            text not null,       -- rule_proposed / rule_active / penalty_applied / ai_judged ...
  summary         text not null,       -- 表示用の日本語テキスト
  created_at      timestamptz not null default now()
);

alter table events enable row level security;
create index if not exists idx_events_group on events(group_id, created_at desc);
