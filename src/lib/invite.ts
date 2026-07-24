import { randomBytes } from "crypto";

// URL に載せる招待コード（推測されにくいランダム文字列）。
export function generateInviteCode(): string {
  return randomBytes(9).toString("base64url"); // 12文字程度
}
