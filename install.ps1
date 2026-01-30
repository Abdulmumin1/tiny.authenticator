$ErrorActionPreference = "Stop"

$PRIMARY = "FF69B4"
$REPO = "Abdulmumin1/tiny.authenticator"
$INSTALL_DIR = "$env:USERPROFILE\.tinyuth\bin"

function Write-Primary { param($text) Write-Host $text -ForegroundColor $PRIMARY }
function Write-Muted { param($text) Write-Host $text -ForegroundColor Gray }
function Write-Info { param($text) Write-Host $text -ForegroundColor Cyan }

$arch = $env:PROCESSOR_ARCHITECTURE
if ($arch -eq "AMD64") {
    $arch = "x64"
} elseif ($arch -eq "ARM64") {
    $arch = "arm64"
} else {
    Write-Host "Unsupported architecture: $arch" -ForegroundColor Red
    exit 1
}

$filename = "tinyuth-windows-${arch}.exe"
Write-Muted "Detected: windows-${arch}"

Write-Muted "Fetching latest version..."

try {
    $response = Invoke-WebRequest -Uri "https://github.com/$REPO/releases/latest" -Method Head -MaximumRedirection 0 -ErrorAction SilentlyContinue
    if ($response.StatusCode -eq 302) {
        $latestTag = $response.Headers["Location"] | Split-Path -Leaf
    }
} catch {
    try {
        $latestRelease = Invoke-RestMethod -Uri "https://api.github.com/repos/$REPO/releases/latest"
        $latestTag = $latestRelease.tag_name
    } catch {
        Write-Host "Failed to fetch latest version." -ForegroundColor Red
        exit 1
    }
}

if (-not $latestTag) {
    Write-Host "Could not determine latest tag." -ForegroundColor Red
    exit 1
}

Write-Muted "Installing version: $latestTag"

$url = "https://github.com/$REPO/releases/download/$latestTag/$filename"
$destDir = $INSTALL_DIR
$dest = "$destDir\tinyuth.exe"

if (-not (Test-Path $destDir)) {
    New-Item -ItemType Directory -Force -Path $destDir | Out-Null
}

Write-Muted "Downloading..."
try {
    Invoke-WebRequest -Uri $url -OutFile $dest
} catch {
    Write-Host "Download failed from $url" -ForegroundColor Red
    exit 1
}

$ps_url = "https://github.com/$REPO/releases/download/$latestTag/windows_selection.ps1"
$ps_dest = "$destDir\windows_selection.ps1"
Write-Muted "Downloading helper script..."
try {
    Invoke-WebRequest -Uri $ps_url -OutFile $ps_dest
} catch {
    Write-Host "Warning: Failed to download windows_selection.ps1" -ForegroundColor Yellow
}

$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$INSTALL_DIR*") {
    $newPath = "$userPath;$INSTALL_DIR"
    [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
    Write-Muted "Added to User PATH."
}

Write-Host ""
Write-Primary "tinyuth installed successfully!"
Write-Host ""
Write-Muted "To get started:"
Write-Muted "1. Restart your terminal."
Write-Muted "2. Run: tinyuth"
Write-Host ""
