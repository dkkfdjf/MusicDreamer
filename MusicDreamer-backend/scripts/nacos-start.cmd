@echo off
rem Nacos 2.2.3 standalone startup (requires JDK 17+)
rem Usage: double-click, or run scripts\nacos-start.cmd from backend dir
if not exist "%JAVA_HOME%\bin\java.exe" (
  if exist "D:\jdk-17.0.11\bin\java.exe" set "JAVA_HOME=D:\jdk-17.0.11"
)
echo JAVA_HOME=%JAVA_HOME%
cd /d "%~dp0..\tools\nacos\bin"
call startup.cmd -m standalone
