import protobuf from 'protobufjs'

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

// 2. Helper function to convert Buffer to Base32 (RFC 4648)
// This is required to make the secret readable for password managers
function toBase32(buffer:any) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = 0;
    let value = 0;
    let output = '';

    for (let i = 0; i < buffer.length; i++) {
        value = (value << 8) | buffer[i];
        bits += 8;
        while (bits >= 5) {
            output += alphabet[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }
    if (bits > 0) {
        output += alphabet[(value << (5 - bits)) & 31];
    }
    return output;
}

// 3. Main Execution
export async function decode(uriString: string) {
    // Parse the schema
    const root = protobuf.parse(typeDefs).root;
    const MigrationPayload = root.lookupType("MigrationPayload");

    console.log(uriString)

    try {
        // Extract the 'data' parameter
        const urlParams = new URLSearchParams(uriString.split('?')[1]);
        const dataParam = urlParams.get('data');

        //@ts-ignore Decode Base64
        const buffer = Buffer.from(dataParam, 'base64');

        // Decode Protobuf
        const message = MigrationPayload.decode(buffer);

        //@ts-ignore Return the decoded accounts
        const accounts = message.otpParameters.map((otp) => {
            const secretBase32 = toBase32(otp.secret);
            const type = otp.type === 2 ? 'TOTP' : 'HOTP';
            return {
                name: otp.name,
                issuer: otp.issuer,
                secret: secretBase32,
                type,
            };
        });

        return accounts;

    } catch (e: typeof Error | any) {
        throw new Error("Error decoding: " + e?.message );
    }
}