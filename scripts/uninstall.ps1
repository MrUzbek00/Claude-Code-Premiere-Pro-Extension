# Removes the Claude Bridge panel and the Claude Code MCP registration (Windows).
# PlayerDebugMode and ~/.premiere-bridge/token are left in place; delete them manually if you no longer need them.
$ErrorActionPreference = "Stop"
$dest = Join-Path $env:APPDATA "Adobe\CEP\extensions\com.claude.premierebridge"

if (Test-Path $dest) {
    $item = Get-Item $dest -Force
    if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { [IO.Directory]::Delete($dest) }
    else { Remove-Item $dest -Recurse -Force }
    Write-Host "Removed $dest"
}

if (Get-Command claude -ErrorAction SilentlyContinue) {
    $ErrorActionPreference = "Continue"
    & claude mcp remove premiere-bridge --scope user 2>&1 | Out-Null
    Write-Host "Removed MCP server 'premiere-bridge' from Claude Code."
}
