import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual
} from "node:crypto";
import { query } from "./db.js";

export const SESSION_COOKIE = "asysha_session";

export type AuthUser = {
  id: number;
  username: string;
  displayName: string;
  timezone: string;
};

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const hash = scryptSync(password, salt, 64).toString("base64url");
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [scheme, salt, hash] = storedHash.split(":");

  if (scheme !== "scrypt" || !salt || !hash) {
    return false;
  }

  const expected = Buffer.from(hash, "base64url");
  const actual = scryptSync(password, salt, expected.length);

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function createUser(input: {
  username: string;
  password: string;
  displayName?: string;
}) {
  const passwordHash = hashPassword(input.password);
  const result = await query<{
    id: number;
    username: string;
    display_name: string;
    timezone: string;
  }>(
    `
      insert into users (email, username, password_hash, display_name, timezone)
      values ($1, $2, $3, $4, 'Europe/Moscow')
      returning id, username, display_name, timezone
    `,
    [
      `${input.username}@asysha.local`,
      input.username,
      passwordHash,
      input.displayName || input.username
    ]
  );
  const user = result.rows[0];

  if (!user) {
    throw new Error("Failed to create user");
  }

  return toAuthUser(user);
}

export async function verifyLogin(username: string, password: string) {
  const result = await query<{
    id: number;
    username: string;
    display_name: string;
    timezone: string;
    password_hash: string | null;
  }>(
    `
      select id, username, display_name, timezone, password_hash
      from users
      where username = $1
    `,
    [username]
  );
  const user = result.rows[0];

  if (!user?.password_hash || !verifyPassword(password, user.password_hash)) {
    return null;
  }

  return toAuthUser(user);
}

export async function createSession(userId: number) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);

  await query(
    `
      insert into sessions (user_id, token_hash, expires_at)
      values ($1, $2, $3)
    `,
    [userId, tokenHash, expiresAt]
  );

  return {
    token,
    expiresAt
  };
}

export async function getUserBySessionToken(token: string | null) {
  if (!token) {
    return null;
  }

  const result = await query<{
    id: number;
    username: string;
    display_name: string;
    timezone: string;
  }>(
    `
      select u.id, u.username, u.display_name, u.timezone
      from sessions s
      join users u on u.id = s.user_id
      where s.token_hash = $1 and s.expires_at > now()
      limit 1
    `,
    [hashSessionToken(token)]
  );
  const user = result.rows[0];

  return user ? toAuthUser(user) : null;
}

export async function deleteSession(token: string | null) {
  if (!token) {
    return;
  }

  await query("delete from sessions where token_hash = $1", [hashSessionToken(token)]);
}

export function parseCookie(header: string | undefined, name: string) {
  if (!header) {
    return null;
  }

  const cookies = header.split(";").map((part) => part.trim());
  const cookie = cookies.find((part) => part.startsWith(`${name}=`));

  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : null;
}

export function sessionCookie(token: string, expiresAt: Date) {
  return [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Expires=${expiresAt.toUTCString()}`
  ].join("; ");
}

export function clearSessionCookie() {
  return [
    `${SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT"
  ].join("; ");
}

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function toAuthUser(row: {
  id: number;
  username: string;
  display_name: string;
  timezone: string;
}): AuthUser {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    timezone: row.timezone
  };
}
