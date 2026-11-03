import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ENCRYPTION_PREFIX = 'enc:v1:';
const ALGORITHM = 'aes-256-gcm';

/**
 * Kurumsal Şifre Kasası (AES-256-GCM Authenticated Encryption)
 * Exchange Online (SMTP) şifrelerini ve hassas kimlik bilgilerini veritabanında / diskte
 * şifrelenmiş (Encrypted at Rest) olarak saklar; yalnızca gönderim anında bellekte (RAM) çözer.
 */
export class CryptoVault {
  private static cachedKey: Buffer | null = null;

  private static getMasterKey(): Buffer {
    if (this.cachedKey) return this.cachedKey;

    const envKey = process.env.VAULT_MASTER_KEY;
    if (envKey && envKey.trim().length > 0) {
      this.cachedKey = crypto.scryptSync(envKey.trim(), 'fg-group-vault-salt-v1', 32);
      return this.cachedKey;
    }

    const workDir = path.resolve(__dirname, '../../.work');
    const keyFile = path.join(workDir, '.vault.key');

    try {
      if (!fs.existsSync(workDir)) {
        fs.mkdirSync(workDir, { recursive: true });
      }
      if (fs.existsSync(keyFile)) {
        const hex = fs.readFileSync(keyFile, 'utf-8').trim();
        if (hex.length === 64) {
          this.cachedKey = Buffer.from(hex, 'hex');
          return this.cachedKey;
        }
      }
      const generated = crypto.randomBytes(32);
      fs.writeFileSync(keyFile, generated.toString('hex'), { encoding: 'utf-8', mode: 0o600 });
      this.cachedKey = generated;
      return this.cachedKey;
    } catch {
      // Salt-sabit yedek anahtar (dosya sistemi salt-okunursa)
      this.cachedKey = crypto.scryptSync('fg-group-fallback-master-secret-2026', 'fg-vault-salt', 32);
      return this.cachedKey;
    }
  }

  public static isEncrypted(value?: string): boolean {
    return typeof value === 'string' && value.startsWith(ENCRYPTION_PREFIX);
  }

  public static encrypt(plainText?: string): string {
    if (!plainText || plainText.length === 0) return '';
    if (this.isEncrypted(plainText)) return plainText;

    const key = this.getMasterKey();
    const iv = crypto.randomBytes(12); // 96-bit GCM IV
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return `${ENCRYPTION_PREFIX}${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  public static decrypt(cipherText?: string): string {
    if (!cipherText || cipherText.length === 0) return '';
    if (!this.isEncrypted(cipherText)) {
      // Eski düz metin şifre varsa geriye dönük uyumluluk için olduğu gibi döndür
      return cipherText;
    }

    try {
      const payload = cipherText.slice(ENCRYPTION_PREFIX.length);
      const [ivHex, authTagHex, encryptedHex] = payload.split(':');
      if (!ivHex || !authTagHex || !encryptedHex) return '';

      const key = this.getMasterKey();
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const encrypted = Buffer.from(encryptedHex, 'hex');

      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);

      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
      return decrypted.toString('utf8');
    } catch (err) {
      console.warn('CryptoVault şifre çözme uyarısı:', err);
      return '';
    }
  }
}
