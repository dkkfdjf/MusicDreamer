@echo off
setlocal
cd /d "%~dp0"

echo ================================================
echo   MusicDreamer Docker һ������
echo ================================================

REM ---------- 1/4 Docker ���� ----------
docker info >nul 2>&1
if not errorlevel 1 goto engine_ok
echo [1/4] Docker ����δ�������������� Docker Desktop��������Լ 30-60 �룩...
set "DD_EXE=%LOCALAPPDATA%\Programs\DockerDesktop\Docker Desktop.exe"
if not exist "%DD_EXE%" set "DD_EXE=C:\Program Files\Docker\Docker\Docker Desktop.exe"
start "" "%DD_EXE%"
set /a tries=0
:wait_engine
ping -n 4 127.0.0.1 >nul
docker info >nul 2>&1
if not errorlevel 1 goto engine_ok
set /a tries+=1
if %tries% lss 40 goto wait_engine
echo [ʧ��] �ȴ� Docker ���泬ʱ�����ֶ��� Docker Desktop���Ⱦ���ͼ���ȶ��������б��ű���
pause
exit /b 1
:engine_ok
echo [1/4] Docker ���������

REM ---------- 2/4 ������ ----------
echo [2/4] docker compose up -d ...
docker compose up -d mysql redis nacos gateway mod-login mod-music mod-setting mod-upload mod-songlist mod-like mod-media
if errorlevel 1 (
    echo [ʧ��] compose �������������Ϸ�������Ϣ��
    pause
    exit /b 1
)

REM ---------- 3/4 �ȷ���ע��� Nacos ----------
echo [3/4] �ȴ� 8 ������ע��� Nacos��һ�� 1-2 ���ӣ�...
set /a tries=0
:wait_svc
set CNT=0
for /f %%i in ('powershell -NoProfile -Command "(Invoke-RestMethod 'http://localhost:8848/nacos/v1/ns/service/list?pageNo=1&pageSize=20' -TimeoutSec 4).count" 2^>nul') do set CNT=%%i
if %CNT% GEQ 8 goto svc_ok
set /a tries+=1
if %tries% geq 48 goto svc_timeout
ping -n 6 127.0.0.1 >nul
goto wait_svc
:svc_timeout
echo [����] 4 ������δ���� 8 �����񣨵�ǰ %CNT% ������
echo        �� docker compose ps ���Ƿ��������ڷ�����������顶Dockerʹ�ý̡̳��ӱ���
goto summary
:svc_ok
echo [3/4] 8/8 ����ȫ��ע����ɡ�

REM ---------- 4/4 ǰ�� ----------
set FECNT=0
for /f %%i in ('powershell -NoProfile -Command "@(Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue).Count" 2^>nul') do set FECNT=%%i
if %FECNT% GEQ 1 (
    echo [4/4] ǰ���������У�5173 �˿�ռ���У���������
    goto summary
)
if not exist "%~dp0..\frontend\node_modules" (
    echo [4/4] ǰ������δ��װ����������Ҫʱ��cd frontend ��ִ�� npm install �� npm run dev
    goto summary
)
echo [4/4] �����´�������ǰ�� vite���ص��Ǹ����� = ͣǰ�ˣ�...
start "MusicDreamer-frontend" cmd /k "cd /d %~dp0..\frontend && npm run dev"

:summary
echo.
echo ================================================
echo   ȫջ�Ѿ�������������ʣ�
echo     ǰ����ʾ      http://localhost:5173
echo     ���� API      http://localhost:8080
echo     Nacos ����̨  http://localhost:8848/nacos  �˺� nacos/nacos
echo   ֹͣ��˫�� docker-down.cmd�����ݱ�����
echo ================================================
docker compose ps
echo.
pause
