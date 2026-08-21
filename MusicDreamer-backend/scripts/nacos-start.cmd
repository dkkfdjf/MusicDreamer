@echo off
rem Nacos 2.2.3 一键启动（standalone，需 JDK17+）
rem 用法：双击或在 backend 目录执行 scripts
acos-start.cmd
if not exist "%JAVA_HOME%in\java.exe" (
  if exist "D:\jdk-17.0.11in\java.exe" set "JAVA_HOME=D:\jdk-17.0.11"
)
echo JAVA_HOME=%JAVA_HOME%
cd /d "%~dp0..	ools
acosin"
call startup.cmd -m standalone
