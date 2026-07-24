-- =====================================================================
-- penalty MVP 初期スキーマ (0001_init)
-- 仕様: 要求定義書.md 参照
-- 方針:
--   ルール成立 = 本人以外の全員が48時間以内に承認（1人でも却下/未回答なら却下）
--   加点確定  = 他の人が申請し、対象の当人が48時間以内に認めたら確定
--               （当人が却下 or 48h未回答なら却下。判断するのは当人のみ）
--   点数はリセットせず積み上げ。
-- 認証: MVP はメール認証・パスワード復旧なし。独自メンバー認証
--       (password_hash はアプリ側で bcrypt 等でハッシュ化して保存)。
-- =====================================================================

-- gen_random_uuid() 用
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- グループ（作成時にメンバー・集計期間を固定）
-- ---------------------------------------------------------------------
create table groups (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  invite_code  text not null unique,                 -- 参加用URLに載せるコード
  period_type  text not null
                 check (period_type in ('cumulative','monthly','oneshot')),
  period_end   date,                                 -- oneshot のときの最終日
  created_at   timestamptz not null default now(),
  constraint oneshot_needs_end
    check (period_type <> 'oneshot' or period_end is not null)
);

-- ---------------------------------------------------------------------
-- メンバー（作成時に名前だけ登録 → 各自が初回にパスワードを設定して claim）
-- 最大10人はアプリ側 + トリガーで担保
-- ---------------------------------------------------------------------
create table members (
  id             uuid primary key default gen_random_uuid(),
  group_id       uuid not null references groups(id) on delete cascade,
  name           text not null,
  password_hash  text,                    -- 初回設定まで null（未 claim）
  is_creator     boolean not null default false,
  claimed_at     timestamptz,             -- パスワード設定＝本人確定した時刻
  created_at     timestamptz not null default now(),
  unique (group_id, name)
);

-- 1グループ10人まで
create or replace function enforce_member_limit() returns trigger as $$
begin
  if (select count(*) from members where group_id = new.group_id) >= 10 then
    raise exception 'このグループは上限（10人）に達しています';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_member_limit
  before insert on members
  for each row execute function enforce_member_limit();

-- ---------------------------------------------------------------------
-- ルール（例: 遅刻=1点）。本人以外の全員の承認で成立
-- ---------------------------------------------------------------------
create table rules (
  id            uuid primary key default gen_random_uuid(),
  group_id      uuid not null references groups(id) on delete cascade,
  description   text not null,
  points        int  not null check (points > 0),
  status        text not null default 'pending'
                  check (status in ('pending','active','rejected')),
  proposed_by   uuid not null references members(id),
  created_at    timestamptz not null default now(),
  deadline      timestamptz not null default (now() + interval '48 hours'),
  decided_at    timestamptz
);

create table rule_votes (
  rule_id    uuid not null references rules(id) on delete cascade,
  member_id  uuid not null references members(id) on delete cascade,
  approve    boolean not null,             -- true=承認 / false=却下
  created_at timestamptz not null default now(),
  primary key (rule_id, member_id)
);

-- ---------------------------------------------------------------------
-- 加点（ペナルティ申請）。他の人が申請 → 対象の当人が48hで認めたら確定
--   applied_by（申請者）≠ target_member_id（当人）
--   当人が却下 or 48h未回答なら却下。判断するのは当人のみ（承認テーブル不要）
--   points は申請時のルール点数をスナップショット
-- ---------------------------------------------------------------------
create table penalties (
  id                uuid primary key default gen_random_uuid(),
  group_id          uuid not null references groups(id) on delete cascade,
  target_member_id  uuid not null references members(id),
  rule_id           uuid not null references rules(id),
  points            int  not null check (points > 0),
  applied_by        uuid not null references members(id),
  status            text not null default 'pending'
                      check (status in ('pending','confirmed','rejected')),
  created_at        timestamptz not null default now(),
  deadline          timestamptz not null default (now() + interval '48 hours'),
  decided_at        timestamptz,          -- 当人が認めた/却下した時刻
  constraint applied_by_not_target check (applied_by <> target_member_id)
);

-- ---------------------------------------------------------------------
-- 罰（しきい値到達で発動＝表示のみ）
--   kind='threshold' : 個別しきい値（例 threshold=10 → 腕立て50回）
--   kind='periodic'  : 周期（例 interval_points=5 → 5点ごとに腕立て20回）
--   ※ 併用可。罰・しきい値の変更は「全員同意」で行う想定
--     （MVPでは作成者が初期設定。承認フローでの編集は今後追加）
-- ---------------------------------------------------------------------
create table punishments (
  id               uuid primary key default gen_random_uuid(),
  group_id         uuid not null references groups(id) on delete cascade,
  kind             text not null check (kind in ('threshold','periodic')),
  threshold        int check (threshold > 0),       -- kind='threshold' 用
  interval_points  int check (interval_points > 0), -- kind='periodic' 用
  description      text not null,
  created_at       timestamptz not null default now(),
  constraint punishment_value_matches_kind check (
    (kind = 'threshold' and threshold is not null and interval_points is null) or
    (kind = 'periodic'  and interval_points is not null and threshold is null)
  )
);

-- ---------------------------------------------------------------------
-- 集計ビュー: 確定した加点のみ合計（ランキング用）
--   ※ 集計期間での絞り込み（monthly/oneshot）はアプリ側クエリで付与
-- ---------------------------------------------------------------------
create view member_scores as
select
  m.id   as member_id,
  m.group_id,
  m.name,
  coalesce(sum(p.points) filter (where p.status = 'confirmed'), 0) as total_points
from members m
left join penalties p on p.target_member_id = m.id
group by m.id, m.group_id, m.name;

-- ---------------------------------------------------------------------
-- 加点履歴ビュー: 「誰が・どのルールで・何点・いつ・状態」を表示用に整形
--   自分/他人ぶんまとめて一覧できる（group_id と target_member_id で絞る）
-- ---------------------------------------------------------------------
create view penalty_log as
select
  p.id,
  p.group_id,
  p.target_member_id,
  tm.name        as target_name,
  p.applied_by,
  am.name        as applied_by_name,
  p.rule_id,
  r.description   as rule_description,
  p.points,
  p.status,
  p.created_at,
  p.deadline,
  p.decided_at
from penalties p
join members tm on tm.id = p.target_member_id
join members am on am.id = p.applied_by
join rules   r  on r.id  = p.rule_id;

-- 便利インデックス
create index idx_members_group   on members(group_id);
create index idx_rules_group     on rules(group_id);
create index idx_penalties_group on penalties(group_id);
create index idx_penalties_target on penalties(target_member_id);
