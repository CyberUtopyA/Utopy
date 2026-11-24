param([string]$Workspace = (Split-Path -Parent $PSScriptRoot),[ValidateSet('LUA','BASSI')][string]$Name='LUA')
$ErrorActionPreference='Stop'
$projectPath=[IO.Path]::GetFullPath($Workspace)
$outputPath=Join-Path $projectPath 'artifacts/lua-cpanel'
New-Item -ItemType Directory -Path $outputPath -Force | Out-Null
$stamp=Get-Date -Format 'yyyyMMdd-HHmmss'
$stagePath=Join-Path $outputPath "node-$stamp"
New-Item -ItemType Directory -Path $stagePath | Out-Null
$files=@('src/booking/contracts.mjs','src/booking/presentationTemplates.mjs','vendor/utopy-2.0.0-beta.3-interface-a2e06908.tgz')
$files+='src/communication/contracts.mjs'
$files+=@('store','http','runtime-adapter','run','media','existing-media-adapter','admin-invitations','node-host','file-host','provision-node','preflight','communication','communication-telegram','communication-webhook') | ForEach-Object { 'server/booking/'+$_+'.mjs' }
foreach($relative in $files){
 $destination=Join-Path $stagePath $relative
 New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
 Copy-Item -LiteralPath (Join-Path $projectPath $relative) -Destination $destination
}
Copy-Item -LiteralPath (Join-Path $projectPath 'deploy/lua-node/package.json') -Destination (Join-Path $stagePath 'package.json')
Copy-Item -LiteralPath (Join-Path $projectPath 'deploy/lua-node/app.cjs') -Destination (Join-Path $stagePath 'app.cjs')
Copy-Item -LiteralPath (Join-Path $projectPath 'docs/LUA_ENTREGA_AUTOMATICA.md') -Destination (Join-Path $stagePath 'INSTALAR.md')
Copy-Item -LiteralPath (Join-Path $projectPath 'docs/COMUNICACION_VIVA.md') -Destination (Join-Path $stagePath 'COMUNICACION-VIVA.md')
if($Name -eq 'BASSI'){Copy-Item -LiteralPath (Join-Path $projectPath 'docs/BASSI_IMPLEMENTACION.md') -Destination (Join-Path $stagePath 'BASSI-LEEME.md')}
$zipPath=Join-Path $outputPath "$Name-SERVIDOR-NODE-$stamp.zip"
Compress-Archive -Path (Join-Path $stagePath '*') -DestinationPath $zipPath -CompressionLevel Optimal
Get-Item -LiteralPath $zipPath | Select-Object FullName,Length
