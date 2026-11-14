@echo off
setlocal
cd /d "%~dp0"

rem Resolve o executavel sem depender do utilitario where ou de um PATH atualizado.
set "ORBITA_NODE="
for %%N in (node.exe) do set "ORBITA_NODE=%%~$PATH:N"
if not defined ORBITA_NODE if exist "%ProgramFiles%\nodejs\node.exe" set "ORBITA_NODE=%ProgramFiles%\nodejs\node.exe"
if not defined ORBITA_NODE if exist "%ProgramW6432%\nodejs\node.exe" set "ORBITA_NODE=%ProgramW6432%\nodejs\node.exe"
if not defined ORBITA_NODE if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" set "ORBITA_NODE=%LOCALAPPDATA%\Programs\nodejs\node.exe"
if not defined ORBITA_NODE if exist "%ProgramFiles(x86)%\nodejs\node.exe" set "ORBITA_NODE=%ProgramFiles(x86)%\nodejs\node.exe"
if not defined ORBITA_NODE (
  echo Node.js nao foi localizado no PATH nem nas pastas usuais.
  echo Instale Node.js 22 ou superior e abra novamente este arquivo.
  pause
  exit /b 1
)

"%ORBITA_NODE%" -e "process.exit(Number(process.versions.node.split('.')[0]) >= 22 ? 0 : 1)"
if errorlevel 1 (
  echo O Node.js encontrado precisa ser atualizado para a versao 22 ou superior:
  echo "%ORBITA_NODE%"
  pause
  exit /b 1
)
echo Node.js: "%ORBITA_NODE%"
echo Abra http://127.0.0.1:4174 no navegador.
"%ORBITA_NODE%" scripts\serve.mjs
pause
