@echo off
setlocal
cd /d "%~dp0"
set "KEYLOOP_CSC=%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if not exist "%KEYLOOP_CSC%" set "KEYLOOP_CSC=%WINDIR%\Microsoft.NET\Framework\v4.0.30319\csc.exe"
if not exist "%KEYLOOP_CSC%" (
  echo .NET Framework 4.x compiler was not found.
  exit /b 1
)
if not exist dist mkdir dist
"%KEYLOOP_CSC%" /nologo /target:winexe /platform:x64 /optimize+ /utf8output /out:dist\KeyLoop.exe /r:System.Windows.Forms.dll /r:System.Drawing.dll /r:System.Web.Extensions.dll /r:System.Core.dll Program.cs Native.cs Recording.cs RawInput.cs
if errorlevel 1 exit /b 1
"%KEYLOOP_CSC%" /nologo /target:exe /platform:x64 /optimize+ /utf8output /out:dist\KeyLoop.Tests.exe /r:System.Windows.Forms.dll /r:System.Drawing.dll /r:System.Web.Extensions.dll /r:System.Core.dll Program.cs Native.cs Recording.cs RawInput.cs
if errorlevel 1 exit /b 1
dist\KeyLoop.Tests.exe --self-test
if errorlevel 1 exit /b 1
echo Build and self-tests passed.
