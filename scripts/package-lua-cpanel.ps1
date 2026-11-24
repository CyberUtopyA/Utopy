param([string]$Workspace = (Split-Path -Parent $PSScriptRoot),[ValidateSet('LUA','BASSI','MT')][string]$Name='LUA')
$ErrorActionPreference='Stop'
$projectPath=[IO.Path]::GetFullPath($Workspace)
$distPath=Join-Path $projectPath 'dist'
if(!(Test-Path -LiteralPath (Join-Path $distPath 'index.html'))){throw 'Ejecutá pnpm build primero.'}
$packagePath=Join-Path $projectPath 'artifacts/lua-cpanel'
New-Item -ItemType Directory -Path $packagePath -Force | Out-Null
$stamp=Get-Date -Format 'yyyyMMdd-HHmmss'
$stagePath=Join-Path $packagePath "web-$stamp"
New-Item -ItemType Directory -Path $stagePath | Out-Null
# Preserve live server configuration and endpoints. Package only built public assets.
$preserve=@('utopy-bootstrap-nodes.json','lua-node.json')
$generatedRoot=@('index.html','sw.js','registerSW.js','manifest.webmanifest')
foreach($file in Get-ChildItem -LiteralPath $distPath -Recurse -File){
 $relative=$file.FullName.Substring($distPath.Length).TrimStart([char[]]'\/')
 if($relative -notmatch '^assets[\\/]' -and $relative -notin $generatedRoot){continue}
 if($file.Extension -in @('.php','.map') -or $relative -in $preserve){continue}
 if($relative -match '(^|[\\/])\.env|\.(sqlite|db|pem|key|p12|pfx)$'){throw 'Se detectó un archivo no publicable.'}
 $destination=Join-Path $stagePath $relative
 New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
 Copy-Item -LiteralPath $file.FullName -Destination $destination
}
if($Name -eq 'MT'){
 Copy-Item -LiteralPath (Join-Path $projectPath 'docs/MT_EVOLUCION.md') -Destination (Join-Path $stagePath 'MT-LEEME.md')
 Copy-Item -LiteralPath (Join-Path $projectPath 'deploy/lua/LEEME-LUA.txt') -Destination (Join-Path $stagePath 'LEEME-ACTUALIZAR.txt')
}elseif($Name -eq 'BASSI'){
 Copy-Item -LiteralPath (Join-Path $projectPath 'docs/BASSI_IMPLEMENTACION.md') -Destination (Join-Path $stagePath 'BASSI-LEEME.md')
 Copy-Item -LiteralPath (Join-Path $projectPath 'deploy/bassi/LEEME-ACTUALIZAR.txt') -Destination (Join-Path $stagePath 'LEEME-ACTUALIZAR.txt')
}else{
 Copy-Item -LiteralPath (Join-Path $projectPath 'deploy/lua/LEEME-LUA.txt') -Destination (Join-Path $stagePath 'LEEME-LUA.txt')
}
$zipPath=Join-Path $packagePath "$Name-ACTUALIZACION-WEB-$stamp.zip"
Compress-Archive -Path (Join-Path $stagePath '*') -DestinationPath $zipPath -CompressionLevel Optimal
Get-Item -LiteralPath $zipPath | Select-Object FullName,Length
