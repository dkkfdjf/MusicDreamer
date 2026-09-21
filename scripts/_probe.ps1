$urls = New-Object System.Collections.ArrayList
[void]$urls.Add('http://127.0.0.1:8080/data/music/5.mp3')
[void]$urls.Add('http://127.0.0.1:8080/data/music/3.mp3')
[void]$urls.Add('http://127.0.0.1:8080/data/music/7.mp3')
[void]$urls.Add('http://127.0.0.1:8080/data/image/1.jpg')
[void]$urls.Add('http://127.0.0.1:8080/data/image/2.jpg')
$bn = [char]0x3010 + '4K Hi-Res' + [char]0x3011 + '晴天-周杰伦'
$enc = [uri]::EscapeDataString($bn)
[void]$urls.Add(('http://127.0.0.1:8080/data/music/' + $enc + '.mp3'))
[void]$urls.Add(('http://127.0.0.1:8080/data/image/' + $enc + '.jpg'))

foreach ($u in $urls) {
  $line = ''
  try {
    $r = Invoke-WebRequest -Uri $u -UseBasicParsing -Method HEAD -TimeoutSec 5
    $line = ('OK   ' + $r.StatusCode + '  ' + $u)
  } catch {
    $code = 'no-response'
    if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
    $line = ('FAIL ' + $code + '  ' + $u)
  }
  Write-Output $line
}