[CmdletBinding()]
param(
    [ValidateSet('status', 'quartzy-start', 'quartzy-stop', 'quartzy-restart', 'quartzy-release', 'cellstorage-start', 'cellstorage-stop', 'cellstorage-restart', 'cellstorage-print-restart', 'repair-startup', 'open-logs')]
    [string]$OpsAction = 'status',
    [ValidateSet('json', 'text')]
    [string]$Format = 'text'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$script:RootDir = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
. (Join-Path $script:RootDir 'scripts\local-server-manager.ps1')

if (Test-Path -LiteralPath $script:EnvFile) {
    Load-EnvFile -Path $script:EnvFile
}

function Get-ConfigValue {
    param(
        [string]$Name,
        [string]$Default
    )

    $value = [System.Environment]::GetEnvironmentVariable($Name, 'Process')
    if ([string]::IsNullOrWhiteSpace($value)) {
        return $Default
    }

    return $value
}

$script:OpsConsolePort = 3210
$script:CellStorageRoot = Get-ConfigValue -Name 'CELLSTORAGE_ROOT' -Default 'D:\Qiyao\CellStorage-modify_log_251104'
$script:CellStorageServiceName = Get-ConfigValue -Name 'CELLSTORAGE_SERVICE_NAME' -Default 'CellStorageApp'
$script:CellStoragePrintTaskName = Get-ConfigValue -Name 'CELLSTORAGE_PRINT_TASK_NAME' -Default 'CellStorage Print Agent'
$script:CellStoragePrintDir = Join-Path $script:CellStorageRoot 'dymo-print-server-nodejs\src_local'
$script:CellStorageAppLog = Join-Path $script:CellStorageRoot 'service_log.txt'
$script:CellStoragePrintLog = Join-Path $script:CellStoragePrintDir 'print_agent_service_log.txt'

function Get-SafeService {
    param([string]$Name)
    try {
        return Get-Service -Name $Name -ErrorAction Stop
    } catch {
        return $null
    }
}

function Get-SafeScheduledTask {
    param([string]$TaskName)
    try {
        return Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop
    } catch {
        return $null
    }
}

function Test-HttpEndpoint {
    param([string]$Url)
    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 4
        return @{
            ok = ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400)
            status = $response.StatusCode
        }
    } catch {
        return @{
            ok = $false
            status = $null
        }
    }
}

function Convert-ToIsoString {
    param($Value)
    if ($null -eq $Value) {
        return $null
    }

    try {
        return ([DateTimeOffset]$Value).ToString('o')
    } catch {
        return $null
    }
}

function Get-CellStoragePrintProcess {
    $wrapper = Get-CimInstance Win32_Process | Where-Object {
        $_.CommandLine -like "*$($script:CellStorageRoot.Replace('\', '\\'))*start_print_agent*.bat*" -or
        $_.CommandLine -like "*$($script:CellStorageRoot.Replace('\', '\\'))*production_print_agent.py*"
    } | Select-Object -First 1

    if ($null -ne $wrapper) {
        return $wrapper
    }

    return Get-CimInstance Win32_Process | Where-Object {
        $_.CommandLine -like "*$($script:CellStorageRoot.Replace('\', '\\'))*dymo-print-server-nodejs*" -or
        ($_.ParentProcessId -gt 0 -and $_.CommandLine -like '*production_print_agent.py*')
    } | Select-Object -First 1
}

function Get-LogTargets {
    $backendLog = if ($script:State.Services.ContainsKey('backend')) { $script:State.Services['backend'].LogFile } else { $script:ServiceDefinitions['backend'].LogFile }
    $frontendLog = if ($script:State.Services.ContainsKey('frontend')) { $script:State.Services['frontend'].LogFile } else { $script:ServiceDefinitions['frontend'].LogFile }
    $dymoLog = if ($script:State.Services.ContainsKey('dymo')) { $script:State.Services['dymo'].LogFile } else { $script:ServiceDefinitions['dymo'].LogFile }

    return @(
        [pscustomobject]@{ id = 'quartzy-backend'; label = 'Quartzy Backend'; path = $backendLog }
        [pscustomobject]@{ id = 'quartzy-backend-prep'; label = 'Quartzy Backend Prep'; path = $script:ServiceDefinitions['backend'].PrepLog }
        [pscustomobject]@{ id = 'quartzy-frontend-build'; label = 'Quartzy Frontend Build'; path = $script:ServiceDefinitions['frontend'].BuildLog }
        [pscustomobject]@{ id = 'quartzy-frontend-serve'; label = 'Quartzy Frontend Serve'; path = $frontendLog }
        [pscustomobject]@{ id = 'quartzy-dymo'; label = 'Quartzy DYMO'; path = $dymoLog }
        [pscustomobject]@{ id = 'cellstorage-app'; label = 'CellStorage App'; path = $script:CellStorageAppLog }
        [pscustomobject]@{ id = 'cellstorage-print'; label = 'CellStorage Print'; path = $script:CellStoragePrintLog }
    )
}

function Get-QuartzyComponentStatus {
    param([string]$ServiceName)

    $definition = $script:ServiceDefinitions[$ServiceName]
    $entry = $null
    if ($script:State.Services.ContainsKey($ServiceName)) {
        $entry = $script:State.Services[$ServiceName]
    }

    $wrapperPid = $null
    $wrapperAlive = $false
    if ($entry -and $entry.WrapperPid) {
        $wrapperPid = [int]$entry.WrapperPid
        $wrapperAlive = $null -ne (Get-Process -Id $wrapperPid -ErrorAction SilentlyContinue)
    }

    $portPids = @()
    if ($definition.Port) {
        $portPids = @(Get-ListeningPids -Port $definition.Port)
    }

    $health = $null
    $message = 'Stopped.'
    $status = 'stopped'
    if ($wrapperAlive -or $portPids.Count -gt 0) {
        $status = 'running'
        $message = 'Running.'
    }

    if ($ServiceName -eq 'backend' -and $status -eq 'running') {
        $health = Test-HttpEndpoint -Url $script:BackendHealthUrl
        if (-not $health.ok) {
            $status = 'unhealthy'
            $message = 'Port is open but backend health check failed.'
        } else {
            $message = 'Backend health check passed.'
        }
    }

    if ($ServiceName -eq 'frontend' -and $status -eq 'running') {
        $frontendProbe = Test-HttpEndpoint -Url $script:FrontendUrl
        if (-not $frontendProbe.ok) {
            $status = 'unhealthy'
            $message = 'Frontend port is open but page probe failed.'
        } else {
            $message = 'Serving the latest built frontend.'
            $health = $frontendProbe
        }
    }

    return [pscustomobject]@{
        id = "quartzy-$ServiceName"
        project = 'quartzy'
        name = $definition.Name
        serviceKey = $ServiceName
        status = $status
        message = $message
        wrapperPid = $wrapperPid
        port = $definition.Port
        portPids = $portPids
        url = $definition.Url
        startedAt = if ($entry) { [string]$entry.StartedAt } else { $null }
        logFile = if ($entry -and $entry.LogFile) { [string]$entry.LogFile } else { $definition.LogFile }
        health = $health
    }
}

function Get-CellStorageStatus {
    $service = Get-SafeService -Name $script:CellStorageServiceName
    $task = Get-SafeScheduledTask -TaskName $script:CellStoragePrintTaskName
    $printProcess = Get-CellStoragePrintProcess
    $servicePort = @(Get-ListeningPids -Port 5000)

    $appStatus = 'stopped'
    $appMessage = 'Service not running.'
    if ($service -and $service.Status -eq 'Running') {
        $appStatus = 'running'
        $appMessage = 'Windows service is running.'
    } elseif ($service) {
        $appStatus = 'stopped'
        $appMessage = "Windows service state: $($service.Status)"
    } else {
        $appStatus = 'missing'
        $appMessage = 'Windows service is not registered.'
    }

    if ($servicePort.Count -eq 0 -and $appStatus -eq 'running') {
        $appStatus = 'unhealthy'
        $appMessage = 'Service reports running, but port 5000 is not listening.'
    }

    $printStatus = 'stopped'
    $printMessage = 'Print agent not running.'
    if ($null -ne $printProcess) {
        $printStatus = 'running'
        $printMessage = 'Print agent process detected.'
    } elseif ($task) {
        $printStatus = 'idle'
        $printMessage = "Scheduled task state: $($task.State)"
    }

    return @(
        [pscustomobject]@{
            id = 'cellstorage-app'
            project = 'cellstorage'
            name = 'CellStorage App'
            serviceKey = 'app'
            status = $appStatus
            message = $appMessage
            wrapperPid = if ($servicePort.Count -gt 0) { [int]$servicePort[0] } else { $null }
            port = 5000
            portPids = $servicePort
            url = 'http://localhost:5000'
            startedAt = $null
            logFile = $script:CellStorageAppLog
            health = if ($servicePort.Count -gt 0) { Test-HttpEndpoint -Url 'http://localhost:5000' } else { $null }
        }
        [pscustomobject]@{
            id = 'cellstorage-print'
            project = 'cellstorage'
            name = 'CellStorage Print Agent'
            serviceKey = 'print'
            status = $printStatus
            message = $printMessage
            wrapperPid = if ($printProcess) { [int]$printProcess.ProcessId } else { $null }
            port = $null
            portPids = @()
            url = $null
            startedAt = $null
            logFile = $script:CellStoragePrintLog
            health = $null
        }
    )
}

function Get-StatusPayload {
    $quartzyComponents = @(
        Get-QuartzyComponentStatus -ServiceName 'backend'
        Get-QuartzyComponentStatus -ServiceName 'frontend'
        Get-QuartzyComponentStatus -ServiceName 'dymo'
        [pscustomobject]@{
            id = 'quartzy-ops-console'
            project = 'quartzy'
            name = 'Ops Console'
            serviceKey = 'ops-console'
            status = if ((@(Get-ListeningPids -Port $script:OpsConsolePort)).Count -gt 0) { 'running' } else { 'stopped' }
            message = if ((@(Get-ListeningPids -Port $script:OpsConsolePort)).Count -gt 0) { 'Local control plane is reachable.' } else { 'Ops console is not listening.' }
            wrapperPid = $null
            port = $script:OpsConsolePort
            portPids = @(Get-ListeningPids -Port $script:OpsConsolePort)
            url = "http://127.0.0.1:$($script:OpsConsolePort)"
            startedAt = $null
            logFile = Join-Path $script:RootDir 'logs\ops-console.log'
            health = $null
        }
    )
    $cellStorageComponents = @(Get-CellStorageStatus)

    return [pscustomobject]@{
        generatedAt = (Get-Date).ToString('o')
        projects = @(
            [pscustomobject]@{
                id = 'quartzy'
                name = 'Quartzy'
                components = $quartzyComponents
            }
            [pscustomobject]@{
                id = 'cellstorage'
                name = 'CellStorage'
                components = $cellStorageComponents
            }
        )
        logs = @(Get-LogTargets)
        system = [pscustomobject]@{
            rootDir = $script:RootDir
            logsDir = $script:LogsDir
            cellStorageRoot = $script:CellStorageRoot
        }
    }
}

function Invoke-QuartzyScriptAction {
    param([string]$ManagerAction)
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $script:RootDir 'scripts\local-server-manager.ps1') -Action $ManagerAction
    exit $LASTEXITCODE
}

function Stop-CellStoragePrintProcesses {
    $processes = @(Get-CimInstance Win32_Process | Where-Object {
        $_.CommandLine -like "*$($script:CellStorageRoot.Replace('\', '\\'))*dymo-print-server-nodejs*" -or
        $_.CommandLine -like "*$($script:CellStorageRoot.Replace('\', '\\'))*start_print_agent*.bat*" -or
        ($_.CommandLine -like '*production_print_agent.py*' -and $_.ParentProcessId -gt 0)
    })

    foreach ($process in $processes) {
        Stop-ProcessTree -ProcessId ([int]$process.ProcessId)
    }
}

function Restart-CellStoragePrintAgent {
    Stop-CellStoragePrintProcesses
    Start-Sleep -Seconds 2

    $task = Get-SafeScheduledTask -TaskName $script:CellStoragePrintTaskName
    if ($task) {
        Start-ScheduledTask -TaskName $script:CellStoragePrintTaskName
        return
    }

    $fallback = Join-Path $script:CellStorageRoot 'dymo-print-server-nodejs\start_print_agent_service.bat'
    if (-not (Test-Path -LiteralPath $fallback)) {
        throw "CellStorage print agent entrypoint not found: $fallback"
    }

    Start-Process -FilePath $fallback -WindowStyle Hidden | Out-Null
}

switch ($OpsAction) {
    'status' {
        $payload = Get-StatusPayload
        if ($Format -eq 'json') {
            $payload | ConvertTo-Json -Depth 8
        } else {
            $payload
        }
    }
    'quartzy-start' {
        Invoke-QuartzyScriptAction -ManagerAction 'boot-start'
    }
    'quartzy-stop' {
        Invoke-QuartzyScriptAction -ManagerAction 'stop-stack'
    }
    'quartzy-restart' {
        Invoke-QuartzyScriptAction -ManagerAction 'restart-stack'
    }
    'quartzy-release' {
        Invoke-QuartzyScriptAction -ManagerAction 'release-stack'
    }
    'cellstorage-start' {
        Start-Service -Name $script:CellStorageServiceName
        Restart-CellStoragePrintAgent
    }
    'cellstorage-stop' {
        Stop-Service -Name $script:CellStorageServiceName -Force
        Stop-CellStoragePrintProcesses
    }
    'cellstorage-restart' {
        Restart-Service -Name $script:CellStorageServiceName -Force
        Restart-CellStoragePrintAgent
    }
    'cellstorage-print-restart' {
        Restart-CellStoragePrintAgent
    }
    'repair-startup' {
        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'repair-startup.ps1')
        exit $LASTEXITCODE
    }
    'open-logs' {
        Start-Process explorer.exe $script:LogsDir | Out-Null
    }
    default {
        throw "Unsupported action: $OpsAction"
    }
}
