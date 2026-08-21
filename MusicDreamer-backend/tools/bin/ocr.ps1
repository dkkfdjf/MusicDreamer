param([Parameter(Mandatory=$true)][string]$ImgPath)
# 图片文字识别（Windows 内置 WinRT OcrEngine，零依赖零体积）
# 注意：本文件必须保持 UTF-8 BOM，PowerShell 5.1 无 BOM 会按 GBK 误读中文注释导致行为错乱
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Runtime.WindowsRuntime
Add-Type -AssemblyName System.Drawing

# PS 5.1 必须显式预载 WinRT 投影类型，否则类型字面量解析不到
[void][Windows.Globalization.Language, Windows.Globalization, ContentType = WindowsRuntime]
[void][Windows.Graphics.Imaging.SoftwareBitmap, Windows.Graphics.Imaging, ContentType = WindowsRuntime]
[void][Windows.Media.Ocr.OcrEngine, Windows.Media.Ocr, ContentType = WindowsRuntime]

# WinRT 异步转同步等待
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() |
    Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and
        $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
function Await($Op, $Type) {
    $t = $asTaskGeneric.MakeGenericMethod($Type).Invoke($null, @($Op))
    $t.Wait(-1) | Out-Null
    $t.Result
}

# System.Drawing 解码像素（BitmapDecoder.CreateAsync 在 PS 里重载解析有坑）
$fs = [System.IO.File]::OpenRead($ImgPath)
try {
    $bmp = New-Object System.Drawing.Bitmap($fs)
    $w = $bmp.Width; $h = $bmp.Height
    if ($w -gt 4096 -or $h -gt 4096) { throw "图片尺寸 ${w}x${h} 超过 OCR 上限 4096，请先缩放" }
    $rect = New-Object System.Drawing.Rectangle(0, 0, $w, $h)
    $data = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly,
        [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $size = [Math]::Abs($data.Stride) * $h
    $buf = New-Object byte[] $size
    [System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $buf, 0, $size)
    $bmp.UnlockBits($data)
} finally { $fs.Close() }

$ibuf = [System.Runtime.InteropServices.WindowsRuntime.WindowsRuntimeBuffer]::Create($buf, 0, $size, $size)
$soft = [Windows.Graphics.Imaging.SoftwareBitmap]::CreateCopyFromBuffer(
    $ibuf, [Windows.Graphics.Imaging.BitmapPixelFormat]::Bgra8, $w, $h)

# 中文优先，系统语言包缺失时回退用户语言
$lang = [Windows.Globalization.Language]::new('zh-Hans')
$engine = $null
if ([Windows.Media.Ocr.OcrEngine]::IsLanguageSupported($lang)) {
    $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($lang)
}
if (-not $engine) { $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages() }
if (-not $engine) { throw '系统无可用 OCR 语言包：设置 -> 语言 -> 添加中文' }

$result = Await ($engine.RecognizeAsync($soft)) ([Windows.Media.Ocr.OcrResult])
Write-Output $result.Text
