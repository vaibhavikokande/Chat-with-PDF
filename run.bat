@echo off
setlocal

echo.
echo  ============================================================
echo   Chat with your PDF  ^|  Starting server ...
echo  ============================================================
echo.

REM ── Guard: venv must exist ────────────────────────────────────
if not exist "venv\" (
    echo  [ERROR] Virtual environment not found.
    echo  Please run  setup.bat  first.
    echo.
    pause
    exit /b 1
)

REM ── Guard: .env must exist ────────────────────────────────────
if not exist ".env" (
    echo  [ERROR] .env file not found.
    echo  Please run  setup.bat  first and add your API key.
    echo.
    pause
    exit /b 1
)

call venv\Scripts\activate.bat

REM ── Open browser after a short delay so the server is ready ──
start "" cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:5000"

echo  Server : http://localhost:5000
echo  Press Ctrl+C to stop.
echo.

python app.py

REM Keep window open if the server exits unexpectedly
echo.
echo  Server stopped.
pause
endlocal
