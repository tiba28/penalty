import bcrypt from "bcryptjs";

// パスワードは平文で保存せず bcrypt でハッシュ化する。
export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
