import * as jose from 'jose';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KEYS_DIR = join(__dirname, 'keys');
const PRIVATE_KEY_PATH = join(KEYS_DIR, 'private.pem');
const PUBLIC_KEY_PATH = join(KEYS_DIR, 'public.pem');

let privateKey: jose.KeyLike;
let publicKey: jose.KeyLike;
let jwkPublic: jose.JWK;

const JWT_ISSUER = process.env.JWT_ISSUER ?? 'hitfactor';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE ?? 'hitfactor-app';
const JWT_ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRY ?? '1h';
const JWT_REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY ?? '30d';
const POWERSYNC_TOKEN_EXPIRY = process.env.POWERSYNC_TOKEN_EXPIRY ?? '5m';

async function loadOrGenerateKeys(): Promise<void> {
  if (privateKey && publicKey) return;

  if (existsSync(PRIVATE_KEY_PATH) && existsSync(PUBLIC_KEY_PATH)) {
    const privPem = await readFile(PRIVATE_KEY_PATH, 'utf-8');
    const pubPem = await readFile(PUBLIC_KEY_PATH, 'utf-8');
    privateKey = await jose.importPKCS8(privPem, 'RS256');
    publicKey = await jose.importSPKI(pubPem, 'RS256');
  } else {
    console.log('Generating new RS256 key pair...');
    const { privateKey: priv, publicKey: pub } = await jose.generateKeyPair(
      'RS256',
      { modulusLength: 2048 }
    );
    privateKey = priv;
    publicKey = pub;

    // Persist to disk
    await mkdir(KEYS_DIR, { recursive: true });
    const privPem = await jose.exportPKCS8(privateKey);
    const pubPem = await jose.exportSPKI(publicKey);
    await writeFile(PRIVATE_KEY_PATH, privPem);
    await writeFile(PUBLIC_KEY_PATH, pubPem);
    console.log('Key pair saved to', KEYS_DIR);
  }

  jwkPublic = await jose.exportJWK(publicKey);
  jwkPublic.alg = 'RS256';
  jwkPublic.use = 'sig';
  jwkPublic.kid = 'hitfactor-key-1';
}

export async function getPrivateKey(): Promise<jose.KeyLike> {
  await loadOrGenerateKeys();
  return privateKey;
}

export async function getPublicKey(): Promise<jose.KeyLike> {
  await loadOrGenerateKeys();
  return publicKey;
}

export async function getJWKS(): Promise<{ keys: jose.JWK[] }> {
  await loadOrGenerateKeys();
  return { keys: [jwkPublic] };
}

export interface TokenPayload {
  sub: string;
  email: string;
  roles: string[];
}

export async function signAccessToken(payload: TokenPayload): Promise<string> {
  const key = await getPrivateKey();
  return new jose.SignJWT({ email: payload.email, roles: payload.roles })
    .setProtectedHeader({ alg: 'RS256', kid: 'hitfactor-key-1' })
    .setSubject(payload.sub)
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(JWT_ACCESS_EXPIRY)
    .sign(key);
}

export async function signRefreshToken(
  payload: TokenPayload
): Promise<string> {
  const key = await getPrivateKey();
  return new jose.SignJWT({
    email: payload.email,
    roles: payload.roles,
    type: 'refresh',
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'hitfactor-key-1' })
    .setSubject(payload.sub)
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(JWT_REFRESH_EXPIRY)
    .sign(key);
}

export async function signPowerSyncToken(userId: string): Promise<string> {
  const key = await getPrivateKey();
  const powersyncUrl = process.env.POWERSYNC_URL ?? 'http://localhost:8080';
  return new jose.SignJWT({})
    .setProtectedHeader({ alg: 'RS256', kid: 'hitfactor-key-1' })
    .setSubject(userId)
    .setIssuer(JWT_ISSUER)
    .setAudience(powersyncUrl)
    .setIssuedAt()
    .setExpirationTime(POWERSYNC_TOKEN_EXPIRY)
    .sign(key);
}

export async function verifyJWT(
  token: string
): Promise<jose.JWTVerifyResult> {
  const key = await getPublicKey();
  return jose.jwtVerify(token, key, {
    issuer: JWT_ISSUER,
    audience: [JWT_AUDIENCE, process.env.POWERSYNC_URL ?? 'http://localhost:8080'],
  });
}
