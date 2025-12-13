# Tiny Authenticator

A modern, secure command-line TOTP (Time-based One-Time Password) authenticator built with TypeScript and Ink. Manage your 2FA tokens with ease, supporting registration via QR codes, secure storage, and export/import capabilities compatible with Google Authenticator.


```bash
bun add -g tinyuth@latest
# or npm or pnpm
```

![](https://rawcontent.dearfutureself.me/portfolio/tiny.auth-image-1.png)

## TOTP Algorithm Overview

TOTP (Time-based One-Time Password) is a standard for generating temporary passwords based on time. It uses HMAC-SHA1 (or other hash functions) with a shared secret and the current time to produce 6-8 digit codes that change every 30 seconds.

- [x] Uses system keychain (keytar) for encrypted secret storage
- [x] Native OS screenshot tools for capturing QR codes
- [x] Compatibility with Google Authenticator export/import

### How TOTP Works

1. **Shared Secret**: A base32-encoded secret key shared between the authenticator and the service
2. **Time Window**: Current Unix time divided by 30-second intervals
3. **HMAC Calculation**: HMAC-SHA1 of the time counter using the secret key
4. **Dynamic Trunacation**: Extract 4 bytes from the HMAC result using dynamic truncation
5. **Code Generation**: Convert to a 6-digit number (modulo 1,000,000)

#### Dynamic Trunacation algo (interactive article on thirdpen.app)

![Dynamic Trunacation algo (interactive article on thirdpen.app)](https://rawcontent.dearfutureself.me/portfolio/thirdpen-explanation-of-dynamic-trunacation.png)

### Privacy & Security

- **No Data Transmission**: All operations local, no internet required
- **Encrypted Storage**: Secrets stored in OS-native secure storage
- **Temporary Displays**: QR codes shown only when requested

## Contributing

```bash
# Clone the repository
git clone <repository-url>
cd tiny.authenticator

# Install dependencies
bun install
```

## Usage

### Basic Commands

```bash
# install
bun add -g tinyuth 

# Show usage
tinyuth

# Register by capturing QR code from screen
tinyuth register cc

# Register a new token manually
tinyuth register

# Show all tokens
tinyuth show

# Show specific account token
tinyuth "GitHub:username"
```

### Import/Export

```bash
# Import from Google Authenticator migration URI
tinyuth import google "otpauth-migration://..."

# Import from QR code image file
tinyuth import qr /path/to/qr.png

# Export all accounts as Google migration QR
tinyuth export google

# Export single account as QR
tinyuth export qr "issuer:name"
```

## Command Reference

| Command               | Description                             |
| --------------------- | --------------------------------------- |
| `register`            | Interactive token registration          |
| `register cc`         | Capture QR from screen for registration |
| `show`                | Display all active tokens               |
| `show <account>`      | Display token for specific account      |
| `import google <uri>` | Import from Google migration URI        |
| `import qr <path>`    | Import from QR code image               |
| `export google`       | Export all as Google migration QR       |
| `export qr <account>` | Export account as QR code               |

## Security Notes

- Secrets are stored encrypted in your system's keychain
- QR codes are displayed temporarily and not saved
- No data is transmitted over the internet
- Compatible with RFC 6238 TOTP standard

## Requirements

- Node.js/Bun runtime
- macOS, Linux, or Windows
- For QR capture: ImageMagick or system screenshot tools

## Development

Built with:

- **TypeScript**: Type-safe development
- **Ink**: React-like CLI components
- **Protobuf.js**: Google migration protocol handling
- **Keytar**: Secure credential storage

## License

[Add license information]
