if (typeof window !== "undefined") {
  throw new Error("SERVER_ONLY_ERROR: Módulo de criptografia não pode ser executado no navegador.");
}

import crypto from "node:crypto";

export interface EncryptedPayload {
  version: number;
  keyVersion: number;
  algorithm: string;
  iv: string;
  authTag: string;
  ciphertext: string;
}

/**
 * Carrega a chave de criptografia master do ambiente,
 * decodifica de base64 e garante RIGOROSAMENTE 32 bytes.
 */
function getMasterEncryptionKey(): Buffer {
  const envKey = process.env.CREDENTIALS_ENCRYPTION_KEY_BASE64 || process.env.CREDENTIALS_ENCRYPTION_KEY;

  if (!envKey) {
    throw new Error("CRYPTO_ERROR: Variável CREDENTIALS_ENCRYPTION_KEY_BASE64 ausente no ambiente.");
  }

  // Tentar decodificar Base64 ou utilizar Buffer se formato hexadecimal de 64 caracteres
  let keyBuffer: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(envKey)) {
    keyBuffer = Buffer.from(envKey, "hex");
  } else {
    keyBuffer = Buffer.from(envKey, "base64");
  }

  if (keyBuffer.length !== 32) {
    throw new Error(
      `CRYPTO_ERROR: Chave de criptografia inválida. Tamanho esperado: 32 bytes, recebido: ${keyBuffer.length} bytes.`
    );
  }

  return keyBuffer;
}

/**
 * Criptografa o Access Token usando AES-256-GCM com IV de 12 bytes aleatório por operação.
 */
export function encryptCredentials(plainText: string, keyVersion: number = 1): string {
  if (!plainText || typeof plainText !== "string") {
    throw new Error("CRYPTO_ERROR: Texto para criptografia não pode ser vazio.");
  }

  const key = getMasterEncryptionKey();
  const iv = crypto.randomBytes(12); // IV de 12 bytes exigido pelo GCM

  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const payload: EncryptedPayload = {
    version: 1,
    keyVersion,
    algorithm: "aes-256-gcm",
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };

  return JSON.stringify(payload);
}

/**
 * Descriptografa o payload AES-256-GCM com verificação estrita de tag e IV.
 */
export function decryptCredentials(encryptedJson: string): string {
  if (!encryptedJson || typeof encryptedJson !== "string") {
    throw new Error("CRYPTO_ERROR: Payload criptografado inválido.");
  }

  let payload: EncryptedPayload;
  try {
    payload = JSON.parse(encryptedJson);
  } catch (e) {
    throw new Error("CRYPTO_ERROR: Falha ao interpretar estrutura do payload criptografado.");
  }

  if (payload.version !== 1 || payload.algorithm !== "aes-256-gcm") {
    throw new Error("CRYPTO_ERROR: Versão ou algoritmo de criptografia não suportado.");
  }

  const key = getMasterEncryptionKey();
  const iv = Buffer.from(payload.iv, "base64");
  const authTag = Buffer.from(payload.authTag, "base64");
  const ciphertext = Buffer.from(payload.ciphertext, "base64");

  if (iv.length !== 12) {
    throw new Error("CRYPTO_ERROR: Tamanho de IV inválido para AES-256-GCM.");
  }

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  try {
    const plainText = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    return plainText;
  } catch (e) {
    throw new Error("CRYPTO_ERROR: Falha de integridade (Tag de autenticação inválida ou dados adulterados).");
  }
}

/**
 * Validação local do formato básico do token (sem exigir prefixo rígido)
 */
export function validateTokenLocalFormat(token: string): { valid: boolean; reason?: string } {
  if (!token || typeof token !== "string") {
    return { valid: false, reason: "O token não pode ser vazio." };
  }

  const trimmed = token.trim();
  if (trimmed.length < 10) {
    return { valid: false, reason: "O token deve possuir pelo menos 10 caracteres." };
  }

  if (trimmed.length > 512) {
    return { valid: false, reason: "O token excede o limite máximo permitido." };
  }

  if (/\s/.test(trimmed)) {
    return { valid: false, reason: "O token não pode conter espaços em branco." };
  }

  if (/[\r\n]/.test(trimmed)) {
    return { valid: false, reason: "O token não pode conter quebras de linha." };
  }

  return { valid: true };
}

/**
 * Mascaramento seguro para exibição no frontend (preserva prefixo conhecido se existir)
 * Formato: APP_USR-••••••••••••1234 ou ••••••••••••1234
 */
export function maskAccessToken(token: string): string {
  if (!token || token.length < 4) return "••••••••••••";

  const clean = token.trim();
  const last4 = clean.slice(-4);

  if (clean.startsWith("APP_USR-")) {
    return `APP_USR-••••••••••••${last4}`;
  }
  if (clean.startsWith("TEST-")) {
    return `TEST-••••••••••••${last4}`;
  }

  return `••••••••••••${last4}`;
}

export interface MercadoPagoCredentials {
  accessToken: string;
  publicKey?: string;
  [key: string]: any;
}

/**
 * Extrai de forma segura o objeto de credenciais do payload criptografado,
 * garantindo que o accessToken seja retornado independentemente se o formato foi JSON ou string pura.
 */
export function parseMercadoPagoCredentials(encryptedJson: string): MercadoPagoCredentials {
  const decryptedString = decryptCredentials(encryptedJson);
  let parsed: any;
  
  try {
    parsed = JSON.parse(decryptedString);
  } catch (e) {
    // Se falhar o parse, significa que foi salvo diretamente como string
    return { accessToken: decryptedString };
  }
  
  if (!parsed || !parsed.accessToken) {
    if (typeof parsed === "string") {
      return { accessToken: parsed };
    }
    throw new Error("CRYPTO_ERROR: Access token ausente nas credenciais descriptografadas.");
  }
  
  return parsed as MercadoPagoCredentials;
}
