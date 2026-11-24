param([Parameter(Mandatory=$true)][string]$BaseZip,[string]$Workspace=(Split-Path -Parent $PSScriptRoot))
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$projectPath=[IO.Path]::GetFullPath($Workspace)
$distPath=Join-Path $projectPath 'dist'
if(!(Test-Path -LiteralPath (Join-Path $distPath 'index.html'))){throw 'Ejecutá pnpm build antes de empaquetar.'}
$basePath=(Resolve-Path -LiteralPath $BaseZip).Path
$outputPath=Join-Path $projectPath 'artifacts/lua-cpanel'
New-Item -ItemType Directory -Path $outputPath -Force | Out-Null
$stamp=Get-Date -Format 'yyyyMMdd-HHmmss'
$stagePath=Join-Path $outputPath "delta-$stamp"
New-Item -ItemType Directory -Path $stagePath | Out-Null
function StreamHash($stream){$algorithm=[Security.Cryptography.SHA256]::Create();try{return [BitConverter]::ToString($algorithm.ComputeHash($stream)).Replace('-','')}finally{$algorithm.Dispose()}}
$base=[IO.Compression.ZipFile]::OpenRead($basePath)
$changed=0;$unchanged=0
try{
 $entries=New-Object 'System.Collections.Generic.Dictionary[string,System.IO.Compression.ZipArchiveEntry]' ([StringComparer]::Ordinal)
 foreach($entry in $base.Entries){$entries[$entry.FullName.Replace('\','/')]=$entry}
 foreach($file in Get-ChildItem -LiteralPath $distPath -Recurse -File){
  $relative=$file.FullName.Substring($distPath.Length).TrimStart([char[]]'\/').Replace('\','/')
  if($relative -notmatch '^assets/' -and $relative -notin @('index.html','sw.js','registerSW.js','manifest.webmanifest')){continue}
  if($relative -match '(^|/)\.env|\.(php|map|sqlite|db|pem|key|pfx)$'){throw 'Archivo no publicable detectado.'}
  $identical=$false
  if($entries.ContainsKey($relative)){
   $prior=$entries[$relative]
   if($prior.Length -eq $file.Length){
    $oldStream=$prior.Open();$newStream=$file.OpenRead()
    try{$identical=(StreamHash $oldStream) -eq (StreamHash $newStream)}finally{$oldStream.Dispose();$newStream.Dispose()}
   }
  }
  if($identical){$unchanged++;continue}
  $destination=Join-Path $stagePath $relative
  New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
  Copy-Item -LiteralPath $file.FullName -Destination $destination
  $changed++
 }
}finally{$base.Dispose()}
Copy-Item -LiteralPath (Join-Path $projectPath 'deploy/lua/LEEME-PARCHE-LOGO.txt') -Destination (Join-Path $stagePath 'LEEME-PARCHE-LOGO.txt')
$zipPath=Join-Path $outputPath "LUA-PARCHE-LOGO-$stamp.zip"
Compress-Archive -Path (Join-Path $stagePath '*') -DestinationPath $zipPath -CompressionLevel Optimal
Get-Item -LiteralPath $zipPath | Select-Object FullName,Length
[PSCustomObject]@{Base=[IO.Path]::GetFileName($basePath);Changed=$changed;UnchangedOmitted=$unchanged}
