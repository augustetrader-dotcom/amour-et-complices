# Redémarre proprement le serveur couple-app :
#   1. Stoppe tous les anciens processus node qui tournent server.js
#   2. Lance npm start
Write-Host "== Arret des anciens processus node (server.js) =="
$procs = Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like '*server.js*' }
if ($procs) {
  foreach ($p in $procs) {
    Write-Host "  Arret de PID $($p.ProcessId) ($($p.CommandLine))"
    Stop-Process -Id $p.ProcessId -Force
  }
} else {
  Write-Host "  Aucun processus serveur en cours."
}

Start-Sleep -Seconds 1
Write-Host "== Demarrage du serveur =="
npm start