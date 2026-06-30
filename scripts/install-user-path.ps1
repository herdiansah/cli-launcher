$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
$targetPath = $projectRoot.Path.TrimEnd("\")
$currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
$windowsAppsPath = Join-Path $env:LOCALAPPDATA "Microsoft\WindowsApps"

if ([string]::IsNullOrWhiteSpace($currentPath)) {
  [Environment]::SetEnvironmentVariable("Path", $targetPath, "User")
  Write-Output "Added $targetPath to user PATH."
  Write-Output "Open a new terminal, then run: tl"
  Write-Output "To use this terminal now, run: `$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')"
  exit 0
}

$currentPath = $currentPath.Replace("$windowsAppsPath$targetPath", "$windowsAppsPath;$targetPath")
$entries = $currentPath -split ";" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
$alreadyInstalled = $entries | Where-Object {
  $_.TrimEnd("\").Equals($targetPath, [StringComparison]::OrdinalIgnoreCase)
}

if ($alreadyInstalled) {
  $nextPath = $entries -join ";"
  [Environment]::SetEnvironmentVariable("Path", $nextPath, "User")
  Write-Output "$targetPath is already in user PATH."
  Write-Output "Open a new terminal, then run: tl"
  Write-Output "To use this terminal now, run: `$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')"
  exit 0
}

$nextPath = ($entries + $targetPath) -join ";"
[Environment]::SetEnvironmentVariable("Path", $nextPath, "User")

Write-Output "Added $targetPath to user PATH."
Write-Output "Open a new terminal, then run: tl"
Write-Output "To use this terminal now, run: `$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')"
