import * as jose from "jose";
import type { Env, SessionPayload } from "./types";

const ALG = "HS256";
const SESSION_TTL = 7 * 24 * 60 * 60; // 7 days in seconds

export async function createSessionToken(
  payload: Omit<SessionPayload, "exp">,
  env: Env,
): Promise<string> {
  const secret = new TextEncoder().encode(env.SESSION_SECRET);
  return new jose.SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALG })
    .setExpirationTime(`${SESSION_TTL}s`)
    .setIssuedAt()
    .sign(secret);
}

export async function verifySessionToken(
  token: string,
  env: Env,
): Promise<SessionPayload> {
  const secret = new TextEncoder().encode(env.SESSION_SECRET);
  const { payload } = await jose.jwtVerify(token, secret, {
    algorithms: [ALG],
  });
  return payload as unknown as SessionPayload;
}
