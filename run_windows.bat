@echo off
setlocal
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
    echo Creating the project's Python environment...
    py -m venv .venv
    if errorlevel 1 (
        echo Could not create the environment. Check that Python is installed and available with the py command.
        pause
        exit /b 1
    )
)
call .venv\Scripts\activate.bat
if errorlevel 1 (
    echo Could not activate the Python environment.
    pause
    exit /b 1
)
echo Installing or checking the Flask dependency...
python -m pip install -r requirements.txt
if errorlevel 1 (
    echo Dependency installation failed. Check your internet connection, then run this file again.
    pause
    exit /b 1
)
echo Starting SafeRoute. Keep this window open while using the app.
echo Open http://127.0.0.1:5000 in your browser.
python app.py
pause
