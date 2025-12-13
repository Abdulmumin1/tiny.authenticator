import protobuf from "protobufjs";
import qrcode from "qrcode-terminal";
import base32Decode from "base32-decode";

// 1. The Google Auth Migration Protocol Buffer Schema
const typeDefs = `
syntax = "proto3";
message MigrationPayload {
  repeated OtpParameters otp_parameters = 1;
  int32 version = 2;
  int32 batch_size = 3;
  int32 batch_index = 4;
  int32 batch_id = 5;

  message OtpParameters {
    bytes secret = 1;
    string name = 2;
    string issuer = 3;
    Algorithm algorithm = 4;
    int32 digits = 5;
    OtpType type = 6;
    int64 counter = 7;
  }

  enum Algorithm {
    ALGORITHM_UNSPECIFIED = 0;
    ALGORITHM_SHA1 = 1;
    ALGORITHM_SHA256 = 2;
    ALGORITHM_SHA512 = 3;
    ALGORITHM_MD5 = 4;
  }

  enum OtpType {
    OTP_TYPE_UNSPECIFIED = 0;
    OTP_TYPE_HOTP = 1;
    OTP_TYPE_TOTP = 2;
  }
}
`;

// 2. Generate otpauth URI
export function generateOtpAuthUri(
  issuer: string,
  name: string,
  secret: string
): string {
  const label = `${issuer}:${name}`;
  return `otpauth://totp/${encodeURIComponent(
    label
  )}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`;
}

// 3. Generate Google Migration QR
export async function generateGoogleMigrationQR(
  accounts: { issuer: string; name: string; secret: string }[]
): Promise<void> {
  // Parse the schema
  const root = protobuf.parse(typeDefs).root;
  const MigrationPayload = root.lookupType("MigrationPayload");

  // Create payload
  const otpParameters = accounts.map((acc) => ({
    secret: Buffer.from(base32Decode(acc.secret, "RFC4648")),
    name: acc.name,
    issuer: acc.issuer,
    algorithm: 1, // SHA1
    digits: 6,
    type: 2, // TOTP
  }));

  const payload = {
    otpParameters,
    version: 1,
    batchSize: accounts.length,
    batchIndex: 0,
    batchId: Math.floor(Math.random() * 1000000),
  };

  // Encode
  const message = MigrationPayload.create(payload);
  const buffer = MigrationPayload.encode(message).finish();
  // @ts-ignore
  const dataParam = buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  const uri = `otpauth-migration://offline?data=${dataParam}`;

  console.log(
    "Scan this QR code with Google Authenticator to import all accounts:"
  );
  console.log(uri);
  qrcode.generate(uri, { small: true });
}

// 4. Export single account QR
export function exportSingleAccountQR(
  issuer: string,
  name: string,
  secret: string
): void {
  const uri = generateOtpAuthUri(issuer, name, secret);
  console.log(`QR code for ${issuer}:${name}:`);
  qrcode.generate(uri, { small: true });
}
