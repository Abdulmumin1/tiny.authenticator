import protobuf from 'protobufjs'
import { Jimp } from 'jimp'
import jsQR from 'jsqr'
import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import os from 'os'
import path from 'path'

const execAsync = promisify(exec)

// The Google Auth Migration Protocol Buffer Schema
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

// Helper function to convert Buffer to Base32 (RFC 4648)
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

export async function readQRCode(imagePath: string): Promise<string> {
    const image = await Jimp.read(imagePath);
    const { data, width, height } = image.bitmap;
    const code = jsQR(data, width, height);
    if (!code) {
        throw new Error("No QR code found in image");
    }
    return code.data;
}

// Selection Screenshot QR Reading
export async function readQRFromSelection(): Promise<string> {
    const tempPath = path.join(os.tmpdir(), 'auth_screenshot.png');

    console.log("Select the QR code area on screen...");
    if (process.platform === 'win32') {
        console.log("(Drag to select area with mouse, release to capture)");
    } else {
        console.log("(Use mouse to drag selection, then press Enter/Space to capture)");
    }

    try {
        if (process.platform === 'darwin') {
            // macOS: screencapture -i (interactive selection)
            await execAsync(`screencapture -i "${tempPath}"`);
        } else if (process.platform === 'linux') {
            // Linux: scrot -s (selection)
            await execAsync(`scrot -s "${tempPath}"`);
        } else if (process.platform === 'win32') {
            // Windows: PowerShell script for selection
            const scriptPath = path.join(__dirname, 'windows_selection.ps1');
            await execAsync(`powershell -ExecutionPolicy Bypass -File "${scriptPath}" "${tempPath}"`);
        } else {
            throw new Error("Selection screenshot not supported on this platform");
        }

        if (!fs.existsSync(tempPath)) {
            throw new Error("Screenshot cancelled or failed");
        }

        const uri = await readQRCode(tempPath);

        // Cleanup
        fs.unlinkSync(tempPath);

        return uri;
    } catch (error) {
        if (fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath);
        }
        throw error;
    }
}

export async function decode(uriString: string) {
    const root = protobuf.parse(typeDefs).root;
    const MigrationPayload = root.lookupType("MigrationPayload");

    try {
        const urlParams = new URLSearchParams(uriString.split('?')[1]);
        const dataParam = urlParams.get('data');

        const base64 = dataParam.replace(/-/g, '+').replace(/_/g, '/');

        const buffer = Buffer.from(base64, 'base64');

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

export function parseOtpAuthUri(uri: string) {
    // otpauth://totp/issuer:name?secret=...&issuer=...
    const url = new URL(uri);
    if (url.protocol !== 'otpauth:' || url.host !== 'totp') {
        throw new Error("Invalid otpauth URI");
    }
    const path = url.pathname.slice(1); // Remove leading /
    const params = new URLSearchParams(url.search);
    const secret = params.get('secret');
    const issuer = params.get('issuer') || path.split(':')[0];
    const name = path.split(':').slice(1).join(':') || path;

    if (!secret) {
        throw new Error("No secret in URI");
    }

    return { issuer, name, secret };
}

export function generateOtpAuthUri(issuer: string, name: string, secret: string): string {
    const label = `${issuer}:${name}`;
    return `otpauth://totp/${encodeURIComponent(label)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`;
}
