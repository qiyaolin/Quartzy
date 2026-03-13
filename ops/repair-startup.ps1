[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$rootDir = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit 0 -Priority 3
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest

$taskDefinitions = @(
    @{ Name = 'QuartzyBackend'; Description = 'Starts Quartzy backend on boot.'; Execute = (Join-Path $rootDir 'ops\start-quartzy-backend.bat') }
    @{ Name = 'QuartzyFrontend'; Description = 'Starts Quartzy frontend static server on boot.'; Execute = (Join-Path $rootDir 'ops\start-quartzy-frontend.bat') }
    @{ Name = 'QuartzyPrintAgent'; Description = 'Starts Quartzy DYMO print agent on boot.'; Execute = (Join-Path $rootDir 'ops\start-quartzy-dymo.bat') }
    @{ Name = 'QuartzyOpsConsole'; Description = 'Starts Quartzy local ops console on boot.'; Execute = (Join-Path $rootDir 'ops\start-ops-console.bat') }
)

foreach ($task in $taskDefinitions) {
    if (-not (Test-Path -LiteralPath $task.Execute)) {
        throw "Startup wrapper is missing: $($task.Execute)"
    }

    $action = New-ScheduledTaskAction -Execute $task.Execute
    Unregister-ScheduledTask -TaskName $task.Name -Confirm:$false -ErrorAction SilentlyContinue
    Register-ScheduledTask -Action $action -Trigger $trigger -Principal $principal -Settings $settings -TaskName $task.Name -Description $task.Description -Force | Out-Null
    Write-Host "Registered task '$($task.Name)'." -ForegroundColor Green
}

$cellStorageService = Get-Service -Name 'CellStorageApp' -ErrorAction SilentlyContinue
if ($null -eq $cellStorageService) {
    Write-Warn "CellStorageApp Windows service is not registered on this machine."
}

$cellStorageTask = Get-ScheduledTask -TaskName 'CellStorage Print Agent' -ErrorAction SilentlyContinue
if ($null -eq $cellStorageTask) {
    Write-Warn "CellStorage Print Agent scheduled task is not registered on this machine."
}

Write-Host ''
Write-Host 'Quartzy startup repair complete.' -ForegroundColor Cyan
