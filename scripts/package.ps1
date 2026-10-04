# Builds a signed dist\ClaudeBridge-<version>.zxp with Adobe's ZXPSignCmd (optional; the install scripts don't need it).
# Download ZXPSignCmd from https://github.com/Adobe-CEP/CEP-Resources/tree/master/ZXPSignCMD and put it in tools\
# or pass -ZXPSignCmd. A self-signed certificate is created in build\cert.p12 on first run (never commit it).
param(
    [string]$ZXPSignCmd = (Join-Path (Split-Path $PSScriptRoot -Parent) "tools\ZXPSignCmd.exe"),
    [string]$Password = $env:ZXP_CERT_PASSWORD,
    [string]$Tsa = "http://timestamp.digicert.com"
)
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$build = Join-Path $root "build"
$dist = Join-Path $root "dist"
$cert = Join-Path $build "cert.p12"
$stage = Join-Path $build "stage"

if (-not (Test-Path $ZXPSignCmd)) { throw "ZXPSignCmd not found at $ZXPSignCmd. See the comment at the top of this script." }
if (-not $Password) { throw "Set a certificate password with -Password or the ZXP_CERT_PASSWORD environment variable." }

$version = ([xml](Get-Content (Join-Path $root "extension\CSXS\manifest.xml"))).ExtensionManifest.ExtensionBundleVersion
$out = Join-Path $dist "ClaudeBridge-$version.zxp"
New-Item -ItemType Directory -Force $build, $dist | Out-Null

if (-not (Test-Path $cert)) {
    & $ZXPSignCmd -selfSignedCert XX NA "Claude Bridge" "Claude Bridge" $Password $cert
    if ($LASTEXITCODE -ne 0) { throw "Certificate creation failed." }
}

if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
Copy-Item (Join-Path $root "extension") $stage -Recurse
if (Test-Path $out) { Remove-Item $out -Force }

& $ZXPSignCmd -sign $stage $out $cert $Password -tsa $Tsa
if ($LASTEXITCODE -ne 0) {
    Write-Host "Signing with timestamp failed; retrying without -tsa."
    & $ZXPSignCmd -sign $stage $out $cert $Password
    if ($LASTEXITCODE -ne 0) { throw "Signing failed." }
}
Write-Host "Built $out"
Write-Host "Install it with an Adobe ZXP installer (for example ZXPInstaller or Anastasiy's Extension Manager)."
