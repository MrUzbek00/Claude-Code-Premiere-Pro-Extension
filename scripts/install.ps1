# Installs the Claude Bridge panel for the current user (Windows) and registers the MCP server with Claude Code.
#   -Copy      copy the panel instead of linking it (default: junction, so `git pull` updates the panel)
#   -SkipMcp   do not run `claude mcp add`
# Restart Premiere Pro afterwards.
param([switch]$Copy, [switch]$SkipMcp)
$ErrorActionPreference = "Stop"

$root = Split-Path $PSScriptRoot -Parent
$src = Join-Path $root "extension"
$server = Join-Path $root "mcp\server.js"
$dest = Join-Path $env:APPDATA "Adobe\CEP\extensions\com.claude.premierebridge"

# Node.js 18+ is needed for the MCP server (global fetch).
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { throw "Node.js 18+ is required. Install it from https://nodejs.org and re-run this script." }
$major = [int]((& node -p "process.versions.node.split('.')[0]").Trim())
if ($major -lt 18) { throw "Node.js 18+ is required (found $(& node --version))." }

# Remove a previous install. A junction is unlinked without touching its target.
New-Item -ItemType Directory -Force (Split-Path $dest) | Out-Null
if (Test-Path $dest) {
    $item = Get-Item $dest -Force
    if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { [IO.Directory]::Delete($dest) }
    else { Remove-Item $dest -Recurse -Force }
}

if ($Copy) {
    Copy-Item $src $dest -Recurse
    Write-Host "Copied panel to $dest"
} else {
    New-Item -ItemType Junction -Path $dest -Target $src | Out-Null
    Write-Host "Linked $dest -> $src"
}

# Unsigned panels load only with PlayerDebugMode. CSXS 9-12 covers Premiere Pro 2019 and later.
foreach ($v in 9..12) {
    $key = "HKCU:\Software\Adobe\CSXS.$v"
    if (-not (Test-Path $key)) { New-Item $key | Out-Null }
    Set-ItemProperty -Path $key -Name PlayerDebugMode -Value "1" -Type String
}
Write-Host "PlayerDebugMode enabled for CSXS 9-12."

if (-not $SkipMcp) {
    if (Get-Command claude -ErrorAction SilentlyContinue) {
        # Native stderr would become a terminating error under "Stop".
        $ErrorActionPreference = "Continue"
        & claude mcp remove premiere-bridge --scope user 2>&1 | Out-Null
        & claude mcp add premiere-bridge --scope user -- node "$server"
        if ($LASTEXITCODE -ne 0) { throw "claude mcp add failed (exit $LASTEXITCODE)." }
        $ErrorActionPreference = "Stop"
        Write-Host "Registered MCP server 'premiere-bridge' with Claude Code (user scope)."
    } else {
        Write-Host "Claude Code CLI not found. Register the server manually:"
        Write-Host "  claude mcp add premiere-bridge --scope user -- node `"$server`""
    }
}

Write-Host ""
Write-Host "Done. Restart Premiere Pro, then open Window > Extensions (Legacy) > Claude Bridge."
Write-Host "Check the setup any time with: npm run doctor"
