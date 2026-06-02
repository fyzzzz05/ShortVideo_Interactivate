# ShortVideo-Platform 后端启动脚本
# 在 PowerShell 中运行此脚本： .\start_backend.ps1

$BackendDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location (Join-Path $BackendDir "backend")

# 使用 shortvideo conda 环境的 Python
$PythonExe = "D:\Code\miniconda\envs\shortvideo\python.exe"

Write-Host ">>> Starting backend at http://127.0.0.1:8000" -ForegroundColor Green
Write-Host ">>> Swagger docs: http://127.0.0.1:8000/docs" -ForegroundColor Cyan
Write-Host ""

& $PythonExe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
