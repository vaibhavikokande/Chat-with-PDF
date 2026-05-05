@echo off
setlocal EnableDelayedExpansion

echo.
echo  ============================================================
echo   Chat with your PDF  ^|  First-time Setup
echo  ============================================================
echo.

REM ── 1. Check Python ──────────────────────────────────────────
python --version >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Python was not found in your PATH.
    echo.
    echo  Please install Python 3.8 or newer from:
    echo    https://www.python.org/downloads/
    echo.
    echo  IMPORTANT: During installation check
    echo    "Add Python to PATH"
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%V in ('python --version 2^>^&1') do set PYVER=%%V
echo  [OK] %PYVER% detected.

REM ── 2. Create virtual environment ────────────────────────────
if not exist "venv\" (
    echo.
    echo  Creating virtual environment ...
    python -m venv venv
    if errorlevel 1 (
        echo  [ERROR] Could not create the virtual environment.
        pause
        exit /b 1
    )
    echo  [OK] Virtual environment created.
) else (
    echo  [OK] Virtual environment already exists — skipping creation.
)

REM ── 3. Activate and install dependencies ─────────────────────
echo.
echo  Installing dependencies  (this may take 1-2 minutes) ...
call venv\Scripts\activate.bat

pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt
if errorlevel 1 (
    echo.
    echo  [ERROR] Dependency installation failed.
    echo  Check your internet connection and try again.
    pause
    exit /b 1
)
echo  [OK] All dependencies installed.

REM ── 4. Create .env and ask user to add API key ───────────────
if not exist ".env" (
    copy ".env.example" ".env" >nul
    echo.
    echo  ────────────────────────────────────────────────────────
    echo   ACTION REQUIRED
    echo  ────────────────────────────────────────────────────────
    echo   Your .env file has been created from the template.
    echo   Notepad will open it now.
    echo.
    echo   Replace  your_api_key_here  with your Anthropic API key.
    echo   Get one free at:  https://console.anthropic.com/
    echo.
    echo   Save the file, close Notepad, then press any key here.
    echo  ────────────────────────────────────────────────────────
    echo.
    start /wait notepad ".env"
) else (
    echo  [OK] .env already exists — skipping.
)

echo.
echo  ============================================================
echo   Setup complete!
echo.
echo   Run  run.bat  to launch the app.
echo  ============================================================
echo.
pause
endlocal
