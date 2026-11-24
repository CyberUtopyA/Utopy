param([string]$Workspace=(Split-Path -Parent $PSScriptRoot))
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
$assetDirectory=Join-Path $Workspace 'src/assets'
$jobs=@(
 @('lua-spa-hero-v1.png','lua-hero-720.jpg',720,84),
 @('lua-spa-hero-v1.png','lua-hero-1200.jpg',1200,86),
 @('bassi-salon-original.png','bassi-hero-640.jpg',640,84),
 @('bassi-salon-original.png','bassi-hero-941.jpg',941,82),
 @('lua-logo-v2.png','lua-logo-display.png',600,0),
 @('bassi-logo-original.png','bassi-logo-display.png',640,0)
)
$jpegEncoder=[Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object {$_.MimeType -eq 'image/jpeg'}
foreach($job in $jobs){
 $original=Join-Path $assetDirectory $job[0];$destination=Join-Path $assetDirectory $job[1]
 if($original -eq $destination){throw 'Originals must stay intact.'}
 $image=[Drawing.Image]::FromFile($original)
 try{
  $width=[Math]::Min([int]$job[2],$image.Width);$height=[int][Math]::Round($image.Height*$width/$image.Width)
  $bitmap=[Drawing.Bitmap]::new($width,$height,[Drawing.Imaging.PixelFormat]::Format32bppArgb)
  try{
   $graphics=[Drawing.Graphics]::FromImage($bitmap)
   try{
    $graphics.Clear([Drawing.Color]::Transparent)
    $graphics.CompositingMode=[Drawing.Drawing2D.CompositingMode]::SourceCopy
    $graphics.InterpolationMode=[Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode=[Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.DrawImage($image,[Drawing.Rectangle]::new(0,0,$width,$height))
   }finally{$graphics.Dispose()}
   if([int]$job[3] -eq 0){$bitmap.Save($destination,[Drawing.Imaging.ImageFormat]::Png)}else{
    $parameters=[Drawing.Imaging.EncoderParameters]::new(1)
    try{$parameters.Param[0]=[Drawing.Imaging.EncoderParameter]::new([Drawing.Imaging.Encoder]::Quality,[long]$job[3]);$bitmap.Save($destination,$jpegEncoder,$parameters)}finally{$parameters.Dispose()}
   }
  }finally{$bitmap.Dispose()}
  [pscustomobject]@{Asset=$job[1];Width=$width;Height=$height;Bytes=(Get-Item -LiteralPath $destination).Length;OriginalBytes=(Get-Item -LiteralPath $original).Length}
 }finally{$image.Dispose()}
}
