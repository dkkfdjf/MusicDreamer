Get-CimInstance Win32_Process -Filter "name='java.exe'" | ForEach-Object {
  $c = $_.CommandLine
  if ($c -and $c.Length -gt 200) { $c = $c.Substring(0, 200) }
  Write-Output ("PID " + $_.ProcessId + ": " + $c)
}
