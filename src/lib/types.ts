// DB スキーマ（db/0001_init.sql）に対応する型

export type PeriodType = "cumulative" | "monthly" | "oneshot";
export type RuleStatus = "pending" | "active" | "rejected";
export type PenaltyStatus = "pending" | "confirmed" | "rejected";
export type PunishmentKind = "threshold" | "periodic";

export type Group = {
  id: string;
  name: string;
  invite_code: string;
  period_type: PeriodType;
  period_end: string | null;
  created_at: string;
};

export type Member = {
  id: string;
  group_id: string;
  name: string;
  password_hash: string | null;
  is_creator: boolean;
  claimed_at: string | null;
  created_at: string;
};

export type Rule = {
  id: string;
  group_id: string;
  description: string;
  points: number;
  status: RuleStatus;
  proposed_by: string;
  created_at: string;
  deadline: string;
  decided_at: string | null;
};

export type PenaltySource = "rule" | "ai";

export type Penalty = {
  id: string;
  group_id: string;
  target_member_id: string;
  rule_id: string | null;
  points: number;
  applied_by: string;
  status: PenaltyStatus;
  source: PenaltySource;
  ai_situation: string | null;
  ai_reason: string | null;
  created_at: string;
  deadline: string;
  decided_at: string | null;
};

export type Punishment = {
  id: string;
  group_id: string;
  kind: PunishmentKind;
  threshold: number | null;
  interval_points: number | null;
  description: string;
  created_at: string;
};
