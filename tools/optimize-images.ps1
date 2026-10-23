<#
  optimize-images.ps1
  Resizes source photographs into web-ready JPEGs (respecting EXIF orientation).
  Windows PowerShell 5.1+ only (uses System.Drawing). No external tools required.

  Usage:
    powershell -ExecutionPolicy Bypass -File tools/optimize-images.ps1 -Source "path\to\photo.png" -Dest "assets\img\works\name" -Sizes 1600,800

  Writes <Dest>-<size>.jpg for every requested size (long edge for portraits is capped to size*1.25).
#>
param(
  [Parameter(Mandatory = $true)][string]$Source,
  [Parameter(Mandatory = $true)][string]$Dest,
  [int[]]$Sizes = @(1600, 800),
  [int]$Quality = 80
)

Add-Type -AssemblyName System.Drawing

$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$params = New-Object System.Drawing.Imaging.EncoderParameters(1)
$params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]$Quality)

$img = [System.Drawing.Image]::FromFile((Resolve-Path $Source))
try {
  # Respect EXIF orientation (tag 0x0112) so phone photos are upright.
  if ($img.PropertyIdList -contains 0x0112) {
    $o = $img.GetPropertyItem(0x0112).Value[0]
    switch ($o) {
      2 { $img.RotateFlip([System.Drawing.RotateFlipType]::RotateNoneFlipX) }
      3 { $img.RotateFlip([System.Drawing.RotateFlipType]::Rotate180FlipNone) }
      4 { $img.RotateFlip([System.Drawing.RotateFlipType]::Rotate180FlipX) }
      5 { $img.RotateFlip([System.Drawing.RotateFlipType]::Rotate90FlipX) }
      6 { $img.RotateFlip([System.Drawing.RotateFlipType]::Rotate90FlipNone) }
      7 { $img.RotateFlip([System.Drawing.RotateFlipType]::Rotate270FlipX) }
      8 { $img.RotateFlip([System.Drawing.RotateFlipType]::Rotate270FlipNone) }
    }
  }

  foreach ($size in $Sizes) {
    $w = $img.Width; $h = $img.Height
    if ($w -ge $h) { $scale = [Math]::Min([double]1, $size / $w) }
    else { $scale = [Math]::Min([double]1, ($size * 1.25) / $h) }
    $nw = [int][Math]::Round($w * $scale); $nh = [int][Math]::Round($h * $scale)

    [GC]::Collect()
    $bmp = New-Object System.Drawing.Bitmap -ArgumentList $nw, $nh, ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.DrawImage($img, 0, 0, $nw, $nh)
    $out = "$Dest-$size.jpg"
    $bmp.Save($out, $codec, $params)
    $g.Dispose(); $bmp.Dispose()
    "{0}  {1}x{2}" -f $out, $nw, $nh
  }
}
finally { $img.Dispose() }

