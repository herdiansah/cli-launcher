# Terminal Launcher

A small dependency-free TUI for launching CLI profiles in new terminal tabs or windows.

## Run

```powershell
node .\src\terminal-launcher.js
```

or:

```powershell
npm.cmd start
```

## Run From Any Folder

Install the command shims into your user PATH once:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-user-path.ps1
```

Open a new terminal after installing, then run either command from any folder:

```powershell
tl
```

or:

```powershell
terminal-launcher
```

The selected CLI opens in the folder where you ran `tl`. For example, running `tl` from `D:\work\my-app` launches the selected profile with `D:\work\my-app` as its working directory.

If the same PowerShell window still says `tl` is not recognized, refresh that window's PATH and run it again:

```powershell
$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
tl
```

From inside this project folder, `.\tl` also works because PowerShell does not run commands from the current directory unless you include `.\`.

## Controls

- `Up` / `Down`: select a profile
- `Enter`: launch selected profile
- `a`: add a profile
- `e`: edit selected profile
- `d`: delete selected profile
- `r`: reload `config/profiles.json`
- `q`: quit

## Profiles

Profiles are stored in `config/profiles.json`.

```json
[
  {
    "name": "Codex CLI",
    "command": "codex"
  }
]
```

On Windows, the launcher uses Windows Terminal (`wt.exe`) when available. It checks PATH first, then this common WindowsApps shim:

```text
C:\Users\PC\AppData\Local\Microsoft\WindowsApps\wt.exe
```

```powershell
wt new-tab --title "Codex CLI" -d "D:\work\my-app" powershell.exe -NoExit -Command "codex"
```

If Windows Terminal is unavailable, it falls back to opening a new PowerShell window.
