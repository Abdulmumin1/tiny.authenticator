import * as keytar from "keytar";
import crypto from "crypto";
import base32Decode from "base32-decode";

export class Authenticator {
  interval: number = 30;
  algorithm: string = "sha1";
  SERVICE_NAME: string = process.env.NODE_ENV == "dev" ? 'TINY_AUTHENTICATOR_TEST' : "TINY_AUTHENTICATOR_TEST";

  constructor(interval: number = 30) {
    this.interval = interval;
  }

  async register(ACCOUNT_NAME: string, TOTP_SECRET: string) {
    try {
      await keytar.setPassword(this.SERVICE_NAME, ACCOUNT_NAME, TOTP_SECRET);
      return true;
    } catch (error) {
      return false;
    }
  }

  async deleteAuthStuff(ACCOUNT_NAME: string) {
    const wasDeleted = await keytar.deletePassword(
      this.SERVICE_NAME,
      ACCOUNT_NAME
    );
    return wasDeleted;
  }

  async retrieveSecret(ACCOUNT_NAME: string) {
    const retrievedSecret = await keytar.getPassword(
      this.SERVICE_NAME,
      ACCOUNT_NAME
    );
    return retrievedSecret;
  }

  async generateToken(secret: string) {
    // Decode base32 secret to bytes
    const key = Buffer.from(base32Decode(secret, 'RFC4648'));

    let TIME = Math.floor(Date.now() / (this.interval * 1000));
    const buf = Buffer.alloc(8);
    buf.writeBigInt64BE(BigInt(TIME), 0);
    const hmac = crypto.createHmac(this.algorithm, key).update(buf).digest();

    // @ts-ignore
    const offset = hmac[hmac.length - 1] & 0xf; // @ts-ignore
    const binary = ((hmac[offset] & 0x7f) << 24) | // @ts-ignore Byte 1 (masked to ignore sign bit)
      ((hmac[offset + 1] & 0xff) << 16) | // @ts-ignore Byte 2
      ((hmac[offset + 2] & 0xff) << 8) | // @ts-ignore Byte 3
      (hmac[offset + 3] & 0xff); // Byte 4
    const token = binary % 1000000;

    return token.toString().padStart(6, '0');
  }

  async listAccounts(): Promise<{ account: string; password: string }[]> {
    const accounts = await keytar.findCredentials(this.SERVICE_NAME);
    return accounts;
  }

  async getTokenForAccount(accountName: string) {
    const secret = await this.retrieveSecret(accountName);
    if (secret) {
      const token = await this.generateToken(secret);
      return token;
    }
    return null;
  }
}