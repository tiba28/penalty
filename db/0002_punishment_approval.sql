-- =====================================================================
-- 0002: 罰（punishments）を承認フロー化（ルールと同じ民主的な仕組み）
--   誰でも「追加」「削除」を提案でき、本人以外の全員が48hで承認したら反映。
--   1人でも却下 or 期限切れで却下。
--   status:
--     pending        … 追加提案・承認待ち
--     active         … 成立（＝発動判定に使われる）
--     rejected       … 追加が却下された
--     delete_pending … 成立済みだが「削除」が提案され承認待ち（発動判定には有効）
-- =====================================================================

alter table punishments
  add column if not exists status       text not null default 'pending',
  add column if not exists proposed_by  uuid references members(id),
  add column if not exists deadline     timestamptz not null default (now() + interval '48 hours'),
  add column if not exists decided_at   timestamptz;

alter table punishments drop constraint if exists punishments_status_check;
alter table punishments add constraint punishments_status_check
  check (status in ('pending','active','rejected','delete_pending'));

-- 既存の罰（旧仕様で作成者が直接追加したもの）は成立済みとして扱う
update punishments set status = 'active' where status = 'pending';

create table if not exists punishment_votes (
  punishment_id uuid not null references punishments(id) on delete cascade,
  member_id     uuid not null references members(id) on delete cascade,
  approve       boolean not null,          -- 現在の投票ラウンド（追加 or 削除）への賛否
  created_at    timestamptz not null default now(),
  primary key (punishment_id, member_id)
);

alter table punishment_votes enable row level security;

create index if not exists idx_punishments_group on punishments(group_id);
