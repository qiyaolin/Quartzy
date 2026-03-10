[CmdletBinding()]
param(
    [ValidateSet('start-stack', 'deploy-frontend')]
    [string]$Action = 'start-stack'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$script:RootDir = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$script:EnvFile = Join-Path $script:RootDir '.env.local'
$script:LogsDir = Join-Path $script:RootDir 'logs\local-server'
$script:StateDir = Join-Path $script:RootDir '.local-server-state'
$script:StateFile = Join-Path $script:StateDir 'services.json'
$script:FrontendDir = Join-Path $script:RootDir 'bio-inventory-frontend'
$script:FrontendServeConfig = Join-Path $script:FrontendDir 'serve.json'
$script:BackendDir = Join-Path $script:RootDir 'bio-inventory-backend'
$script:DymoDir = Join-Path $script:RootDir 'dymo-print-server-nodejs'
$script:BackendPort = 8000
$script:FrontendPort = 3000
$script:BackendHealthUrl = "http://localhost:$($script:BackendPort)/health/"
$script:BackendReadyUrl = "http://localhost:$($script:BackendPort)/ready/"
$script:FrontendUrl = "http://localhost:$($script:FrontendPort)/"
$script:State = $null
$script:ServiceDefinitions = @{
    dymo = @{
        Name = 'DYMO Agent'
        Markers = @('dymo-print-server-nodejs', 'production_print_agent.py')
        LogFile = Join-Path $script:LogsDir 'dymo.log'
        Port = $null
        Url = $null
    }
    backend = @{
        Name = 'Backend API'
        Markers = @('bio-inventory-backend', 'manage.py runserver 0.0.0.0:8000')
        LogFile = Join-Path $script:LogsDir 'backend.log'
        PrepLog = Join-Path $script:LogsDir 'backend-prep.log'
        Port = $script:BackendPort
        Url = "http://localhost:$($script:BackendPort)"
    }
    frontend = @{
        Name = 'Frontend UI'
        Markers = @('bio-inventory-frontend', 'serve -s build -l 3000')
        BuildLog = Join-Path $script:LogsDir 'frontend-build.log'
        LogFile = Join-Path $script:LogsDir 'frontend-serve.log'
        Port = $script:FrontendPort
        Url = $script:FrontendUrl
    }
}

function Write-Header {
    param([string]$Title)
    Write-Host '==================================================='
    Write-Host " $Title"
    Write-Host '==================================================='
    Write-Host ''
}

function Write-InfoLine {
    param([string]$Message)
    Write-Host "[INFO] $Message"
}

function Write-OkLine {
    param([string]$Message)
    Write-Host "[OK] $Message"
}

function Write-WarnLine {
    param([string]$Message)
    Write-Host "[WARN] $Message"
}

function Write-ErrorLine {
    param([string]$Message)
    Write-Host "[ERROR] $Message"
}

function Ensure-Directory {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) {
        New-Item -ItemType Directory -Path $Path -Force | Out-Null
    }
}

function Reset-LogFile {
    param([string]$Path)
    Ensure-Directory -Path ([System.IO.Path]::GetDirectoryName($Path))
    [System.IO.File]::WriteAllText($Path, '')
}

function Write-LogBanner {
    param(
        [string]$Path,
        [string]$CommandLine
    )
    $lines = @(
        ('=' * 80),
        ("[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $CommandLine),
        ('=' * 80),
        ''
    )
    Add-Content -Path $Path -Value $lines -Encoding UTF8
}

function Get-StateEntryValue {
    param(
        $Object,
        [string]$Name
    )
    if ($null -eq $Object) {
        return $null
    }

    $property = $Object.PSObject.Properties[$Name]
    if ($null -eq $property) {
        return $null
    }

    return $property.Value
}

function Read-State {
    $state = @{
        Services = @{}
    }

    if (-not (Test-Path -LiteralPath $script:StateFile)) {
        return $state
    }

    try {
        $raw = Get-Content -LiteralPath $script:StateFile -Raw -ErrorAction Stop
        if ([string]::IsNullOrWhiteSpace($raw)) {
            return $state
        }

        $parsed = $raw | ConvertFrom-Json
        $services = Get-StateEntryValue -Object $parsed -Name 'Services'
        foreach ($service in @($services)) {
            $name = [string](Get-StateEntryValue -Object $service -Name 'Name')
            if ([string]::IsNullOrWhiteSpace($name)) {
                continue
            }

            $state.Services[$name] = @{
                Name = $name
                WrapperPid = Get-StateEntryValue -Object $service -Name 'WrapperPid'
                PortPid = Get-StateEntryValue -Object $service -Name 'PortPid'
                Port = Get-StateEntryValue -Object $service -Name 'Port'
                LogFile = Get-StateEntryValue -Object $service -Name 'LogFile'
                StartedAt = Get-StateEntryValue -Object $service -Name 'StartedAt'
            }
        }
    } catch {
        Write-WarnLine "State file could not be parsed and will be recreated: $script:StateFile"
    }

    return $state
}

function Save-State {
    $serviceList = @()
    foreach ($name in @($script:State.Services.Keys | Sort-Object)) {
        $entry = $script:State.Services[$name]
        $serviceList += [pscustomobject]@{
            Name = $entry.Name
            WrapperPid = $entry.WrapperPid
            PortPid = $entry.PortPid
            Port = $entry.Port
            LogFile = $entry.LogFile
            StartedAt = $entry.StartedAt
        }
    }

    $payload = [pscustomobject]@{
        GeneratedAt = (Get-Date).ToString('o')
        Services = $serviceList
    }

    $payload | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $script:StateFile -Encoding UTF8
}

function Remove-StateEntry {
    param([string]$ServiceName)
    if ($script:State.Services.ContainsKey($ServiceName)) {
        $script:State.Services.Remove($ServiceName) | Out-Null
        Save-State
    }
}

function Set-StateEntry {
    param(
        [string]$ServiceName,
        [hashtable]$Entry
    )
    $script:State.Services[$ServiceName] = $Entry
    Save-State
}

function Set-DefaultEnvVar {
    param(
        [string]$Name,
        [string]$Value
    )
    $current = [System.Environment]::GetEnvironmentVariable($Name, 'Process')
    if ([string]::IsNullOrWhiteSpace($current)) {
        [System.Environment]::SetEnvironmentVariable($Name, $Value, 'Process')
    }
}

function Load-EnvFile {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) {
        throw "Missing config file: $Path"
    }

    foreach ($line in Get-Content -LiteralPath $Path) {
        $trimmed = $line.Trim()
        if ([string]::IsNullOrWhiteSpace($trimmed)) {
            continue
        }
        if ($trimmed.StartsWith('#')) {
            continue
        }

        $pair = $trimmed.Split('=', 2)
        $name = $pair[0].Trim()
        if ([string]::IsNullOrWhiteSpace($name)) {
            continue
        }

        $value = ''
        if ($pair.Count -gt 1) {
            $value = $pair[1].Trim()
            if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
                $value = $value.Substring(1, $value.Length - 2)
            }
        }

        [System.Environment]::SetEnvironmentVariable($name, $value, 'Process')
    }
}

function Require-EnvVars {
    param([string[]]$Names)
    $missing = @()
    foreach ($name in $Names) {
        $value = [System.Environment]::GetEnvironmentVariable($name, 'Process')
        if ([string]::IsNullOrWhiteSpace($value)) {
            $missing += $name
        }
    }

    if ($missing.Count -gt 0) {
        throw ("Missing environment variables: {0}" -f ($missing -join ', '))
    }
}

function Test-CommandAvailable {
    param([string]$Name)
    return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Get-ListeningPids {
    param([int]$Port)

    if (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue) {
        $connections = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue
        if ($connections) {
            return @($connections | Select-Object -ExpandProperty OwningProcess -Unique)
        }
    }

    $pidMatches = @()
    foreach ($line in netstat -ano -p tcp) {
        if ($line -match "^\s*TCP\s+\S+:$Port\s+\S+\s+LISTENING\s+(\d+)\s*$") {
            $pidMatches += [int]$Matches[1]
        }
    }

    return @($pidMatches | Sort-Object -Unique)
}

function Get-ProcessInfo {
    param([int]$ProcessId)
    try {
        return Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction Stop
    } catch {
        return $null
    }
}

function Get-ProcessCommandLine {
    param([int]$ProcessId)
    $info = Get-ProcessInfo -ProcessId $ProcessId
    if ($null -eq $info) {
        return $null
    }

    return [string]$info.CommandLine
}

function Test-ProcessMatchesMarkers {
    param(
        [int]$ProcessId,
        [string[]]$Markers
    )

    $commandLine = Get-ProcessCommandLine -ProcessId $ProcessId
    if ([string]::IsNullOrWhiteSpace($commandLine)) {
        return $false
    }

    foreach ($marker in $Markers) {
        if ($commandLine.IndexOf($marker, [System.StringComparison]::OrdinalIgnoreCase) -lt 0) {
            return $false
        }
    }

    return $true
}

function Find-ProcessesByMarkers {
    param([string[]]$Markers)

    $matchedPids = @()
    foreach ($process in Get-CimInstance Win32_Process) {
        $commandLine = [string]$process.CommandLine
        if ([string]::IsNullOrWhiteSpace($commandLine)) {
            continue
        }

        $allMatched = $true
        foreach ($marker in $Markers) {
            if ($commandLine.IndexOf($marker, [System.StringComparison]::OrdinalIgnoreCase) -lt 0) {
                $allMatched = $false
                break
            }
        }

        if ($allMatched) {
            $matchedPids += [int]$process.ProcessId
        }
    }

    return @($matchedPids | Sort-Object -Unique)
}

function Stop-ProcessTree {
    param([int]$ProcessId)
    if ($ProcessId -le 0) {
        return
    }

    & taskkill.exe /PID $ProcessId /T /F > $null 2>&1
}

function Wait-ForPortState {
    param(
        [int]$Port,
        [int]$TimeoutSec,
        [bool]$ShouldBeListening
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        $listening = @(Get-ListeningPids -Port $Port)
        if ($ShouldBeListening -and $listening.Count -gt 0) {
            return $listening
        }
        if ((-not $ShouldBeListening) -and $listening.Count -eq 0) {
            return @()
        }
        Start-Sleep -Seconds 2
    }

    return @()
}

function Wait-ForHttp {
    param(
        [string]$Url,
        [int]$TimeoutSec
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) {
                return $true
            }
        } catch {
        }

        Start-Sleep -Seconds 2
    }

    return $false
}

function Wait-ForFrontendReady {
    param(
        [string]$Url,
        [int]$TimeoutSec
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
                if ($response.Content -match '/static/js/main\.[^"'']+\.js') {
                    return @{
                        Success = $true
                        Message = "Frontend is serving production assets at $Url"
                    }
                }

                if ($response.Content -match '/static/js/bundle\.js') {
                    return @{
                        Success = $false
                        Message = 'Frontend page still points to /static/js/bundle.js (development assets).'
                    }
                }
            }
        } catch {
        }

        Start-Sleep -Seconds 2
    }

    return @{
        Success = $false
        Message = "Timed out waiting for production frontend assets at $Url"
    }
}

function Invoke-LoggedCommand {
    param(
        [string]$DisplayName,
        [string]$WorkingDir,
        [string]$Command,
        [string]$LogFile
    )

    Reset-LogFile -Path $LogFile
    Write-LogBanner -Path $LogFile -CommandLine $Command
    Write-InfoLine $DisplayName

    $cmdLine = "cd /d `"$WorkingDir`" && $Command >> `"$LogFile`" 2>&1"
    & cmd.exe /d /c $cmdLine
    $exitCode = $LASTEXITCODE

    if ($exitCode -ne 0) {
        throw "$DisplayName failed. See $LogFile"
    }

    Write-OkLine "$DisplayName completed."
}

function Start-BackgroundService {
    param(
        [string]$ServiceName,
        [string]$WorkingDir,
        [string]$Command,
        [string]$LogFile
    )

    $definition = $script:ServiceDefinitions[$ServiceName]
    Reset-LogFile -Path $LogFile
    Write-LogBanner -Path $LogFile -CommandLine $Command
    Write-InfoLine "Starting $($definition.Name)..."

    $cmdLine = "cd /d `"$WorkingDir`" && $Command >> `"$LogFile`" 2>&1"
    $process = Start-Process -FilePath 'cmd.exe' -ArgumentList @('/d', '/c', $cmdLine) -WindowStyle Hidden -PassThru
    Start-Sleep -Seconds 2
    $process.Refresh()

    if ($process.HasExited) {
        throw "$($definition.Name) exited immediately. See $LogFile"
    }

    return @{
        Name = $ServiceName
        WrapperPid = $process.Id
        PortPid = $null
        Port = $definition.Port
        LogFile = $LogFile
        StartedAt = (Get-Date).ToString('o')
    }
}

function Test-PortOwnedByQuartzy {
    param([string]$ServiceName)

    $definition = $script:ServiceDefinitions[$ServiceName]
    $stateEntry = $null
    if ($script:State.Services.ContainsKey($ServiceName)) {
        $stateEntry = $script:State.Services[$ServiceName]
    }

    $wrapperPids = @(Find-ProcessesByMarkers -Markers $definition.Markers)
    if ($wrapperPids.Count -gt 0) {
        return $true
    }

    if ($definition.Port) {
        $listening = @(Get-ListeningPids -Port $definition.Port)
        foreach ($processId in $listening) {
            if ($null -ne $stateEntry -and $stateEntry.PortPid -and [int]$stateEntry.PortPid -eq [int]$processId) {
                return $true
            }
        }
    }

    return $false
}

function Assert-PortAvailable {
    param([string]$ServiceName)

    $definition = $script:ServiceDefinitions[$ServiceName]
    if (-not $definition.Port) {
        return
    }

    $listening = @(Get-ListeningPids -Port $definition.Port)
    if ($listening.Count -eq 0) {
        return
    }

    $details = @()
    foreach ($processId in $listening) {
        $commandLine = Get-ProcessCommandLine -ProcessId $processId
        if ([string]::IsNullOrWhiteSpace($commandLine)) {
            $fallbackProcess = Get-Process -Id $processId -ErrorAction SilentlyContinue
            if ($fallbackProcess) {
                $commandLine = $fallbackProcess.ProcessName
            } else {
                $commandLine = 'Unknown process'
            }
        }

        if ($commandLine.Length -gt 160) {
            $commandLine = $commandLine.Substring(0, 160) + '...'
        }
        $details += "PID ${processId}: $commandLine"
    }

    throw ("Port {0} is already in use by a non-Quartzy process. {1}" -f $definition.Port, ($details -join '; '))
}

function Stop-OwnedService {
    param([string]$ServiceName)

    $definition = $script:ServiceDefinitions[$ServiceName]
    $entry = $null
    if ($script:State.Services.ContainsKey($ServiceName)) {
        $entry = $script:State.Services[$ServiceName]
    }

    $candidatePids = @()
    if ($entry -and $entry.WrapperPid) {
        $candidatePids += [int]$entry.WrapperPid
    }
    if ($entry -and $entry.PortPid) {
        $candidatePids += [int]$entry.PortPid
    }
    $candidatePids += @(Find-ProcessesByMarkers -Markers $definition.Markers)
    $candidatePids = @($candidatePids | Sort-Object -Unique)

    foreach ($processId in $candidatePids) {
        $safeToKill = $false
        if (Test-ProcessMatchesMarkers -ProcessId $processId -Markers $definition.Markers) {
            $safeToKill = $true
        } elseif ($definition.Port -and $entry -and $entry.PortPid -and [int]$entry.PortPid -eq [int]$processId) {
            $listening = @(Get-ListeningPids -Port $definition.Port)
            if ($listening -contains [int]$processId) {
                $safeToKill = $true
            }
        }

        if ($safeToKill) {
            Write-InfoLine "Stopping previous $($definition.Name) process tree (PID $processId)..."
            Stop-ProcessTree -ProcessId $processId
        }
    }

    if ($definition.Port) {
        Wait-ForPortState -Port $definition.Port -TimeoutSec 10 -ShouldBeListening:$false | Out-Null
        $remaining = @(Get-ListeningPids -Port $definition.Port)
        if ($remaining.Count -gt 0) {
            Assert-PortAvailable -ServiceName $ServiceName
        }
    }

    Remove-StateEntry -ServiceName $ServiceName
}

function Get-InitialStatuses {
    $statuses = @{}
    foreach ($serviceName in @('dymo', 'backend', 'frontend')) {
        $definition = $script:ServiceDefinitions[$serviceName]
        $statuses[$serviceName] = @{
            Status = 'skipped'
            Message = 'Not started.'
            LogFile = $definition.LogFile
            Url = $definition.Url
        }
    }

    return $statuses
}

function Show-Summary {
    param(
        [System.Collections.IDictionary]$Statuses,
        [string]$ModeName
    )

    Write-Host ''
    Write-Host '==================================================='
    Write-Host " Summary ($ModeName)"
    Write-Host '==================================================='

    foreach ($serviceName in @('dymo', 'backend', 'frontend')) {
        if (-not $Statuses.Contains($serviceName)) {
            continue
        }

        $definition = $script:ServiceDefinitions[$serviceName]
        $status = $Statuses[$serviceName]
        Write-Host ("[{0}] {1}" -f $status.Status.ToUpperInvariant(), $definition.Name)
        Write-Host ("        {0}" -f $status.Message)
        if ($status.Url) {
            Write-Host ("        URL: {0}" -f $status.Url)
        }
        if ($status.LogFile) {
            Write-Host ("        Log: {0}" -f $status.LogFile)
        }
    }

    Write-Host ("Runtime logs: {0}" -f $script:LogsDir)
    Write-Host ("State file:    {0}" -f $script:StateFile)
}

function Test-FrontendPortForUnrelatedProcess {
    $definition = $script:ServiceDefinitions['frontend']
    $listening = @(Get-ListeningPids -Port $definition.Port)
    if ($listening.Count -eq 0) {
        return
    }

    if (-not (Test-PortOwnedByQuartzy -ServiceName 'frontend')) {
        Assert-PortAvailable -ServiceName 'frontend'
    }
}

function Start-Frontend {
    param([switch]$PreserveExistingUntilBuildSucceeds)

    $definition = $script:ServiceDefinitions['frontend']
    $status = @{
        Status = 'failed'
        Message = 'Frontend was not started.'
        LogFile = $definition.LogFile
        Url = $definition.Url
    }

    [System.Environment]::SetEnvironmentVariable('REACT_APP_API_BASE_URL', 'auto', 'Process')
    [System.Environment]::SetEnvironmentVariable('REACT_APP_API_URL', 'auto', 'Process')

    if ($PreserveExistingUntilBuildSucceeds) {
        Test-FrontendPortForUnrelatedProcess
    }

    Invoke-LoggedCommand -DisplayName 'Building frontend production bundle' -WorkingDir $script:FrontendDir -Command 'npm run build' -LogFile $definition.BuildLog

    if ($PreserveExistingUntilBuildSucceeds) {
        Stop-OwnedService -ServiceName 'frontend'
    }

    Assert-PortAvailable -ServiceName 'frontend'
    $serveConfigArg = $script:FrontendServeConfig.Replace('"', '\"')
    $entry = Start-BackgroundService -ServiceName 'frontend' -WorkingDir $script:FrontendDir -Command "npx --yes serve -s build -l 3000 -c `"$serveConfigArg`" --no-port-switching -n -L" -LogFile $definition.LogFile

    $listening = @(Wait-ForPortState -Port $definition.Port -TimeoutSec 90 -ShouldBeListening:$true)
    if ($listening.Count -eq 0) {
        throw "Frontend did not open port $($definition.Port). See $($definition.LogFile)"
    }

    $entry.PortPid = [int]$listening[0]
    Set-StateEntry -ServiceName 'frontend' -Entry $entry

    $ready = Wait-ForFrontendReady -Url $definition.Url -TimeoutSec 90
    if (-not $ready.Success) {
        throw "$($ready.Message) See $($definition.LogFile)"
    }

    Write-OkLine $ready.Message
    $status.Status = 'running'
    $status.Message = 'Serving the latest production bundle.'
    return $status
}

function Initialize-Environment {
    Ensure-Directory -Path $script:LogsDir
    Ensure-Directory -Path $script:StateDir
    $script:State = Read-State
}

function Run-StartStack {
    Write-Header -Title 'Quartzy (Bio-Inventory) Local Full-Stack Starter'
    Write-InfoLine 'Loading local environment configuration...'
    Load-EnvFile -Path $script:EnvFile

    Set-DefaultEnvVar -Name 'DEBUG' -Value 'True'
    Set-DefaultEnvVar -Name 'USE_POSTGRES' -Value 'True'
    Set-DefaultEnvVar -Name 'ALLOWED_HOSTS' -Value 'localhost,127.0.0.1,*'
    Set-DefaultEnvVar -Name 'REACT_APP_API_BASE_URL' -Value "http://localhost:$($script:BackendPort)"

    if (-not (Test-CommandAvailable -Name 'python')) {
        throw 'Python is not available on PATH.'
    }
    if (-not (Test-CommandAvailable -Name 'npm')) {
        throw 'npm is not available on PATH.'
    }
    if (-not (Test-CommandAvailable -Name 'npx')) {
        throw 'npx is not available on PATH.'
    }

    $usePostgres = [string]([System.Environment]::GetEnvironmentVariable('USE_POSTGRES', 'Process'))
    if ($usePostgres.ToLowerInvariant() -eq 'true') {
        Require-EnvVars -Names @('DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASS')
    }

    $statuses = Get-InitialStatuses

    Write-InfoLine 'Cleaning up previously started Quartzy services...'
    foreach ($serviceName in @('frontend', 'backend', 'dymo')) {
        Stop-OwnedService -ServiceName $serviceName
    }

    Assert-PortAvailable -ServiceName 'backend'
    Assert-PortAvailable -ServiceName 'frontend'

    try {
        $dymoDefinition = $script:ServiceDefinitions['dymo']
        $dymoEntry = Start-BackgroundService -ServiceName 'dymo' -WorkingDir $script:DymoDir -Command 'python src/production_print_agent.py' -LogFile $dymoDefinition.LogFile
        Set-StateEntry -ServiceName 'dymo' -Entry $dymoEntry
        $statuses['dymo'].Status = 'running'
        $statuses['dymo'].Message = 'Running in the background.'
        Write-OkLine 'DYMO agent started.'
    } catch {
        $statuses['dymo'].Status = 'failed'
        $statuses['dymo'].Message = $_.Exception.Message
        Write-WarnLine $statuses['dymo'].Message
    }

    try {
        $backendDefinition = $script:ServiceDefinitions['backend']
        Invoke-LoggedCommand -DisplayName 'Installing backend Python requirements' -WorkingDir $script:BackendDir -Command 'python -m pip install -r requirements.txt' -LogFile $backendDefinition.PrepLog
        Invoke-LoggedCommand -DisplayName 'Checking PostgreSQL connectivity' -WorkingDir $script:BackendDir -Command 'python check_postgres_connection.py' -LogFile $backendDefinition.PrepLog
        Invoke-LoggedCommand -DisplayName 'Applying Django migrations' -WorkingDir $script:BackendDir -Command 'python manage.py migrate' -LogFile $backendDefinition.PrepLog

        $backendEntry = Start-BackgroundService -ServiceName 'backend' -WorkingDir $script:BackendDir -Command 'python manage.py runserver 0.0.0.0:8000' -LogFile $backendDefinition.LogFile
        $backendPids = @(Wait-ForPortState -Port $backendDefinition.Port -TimeoutSec 120 -ShouldBeListening:$true)
        if ($backendPids.Count -eq 0) {
            throw "Backend did not open port $($backendDefinition.Port). See $($backendDefinition.LogFile)"
        }

        $backendEntry.PortPid = [int]$backendPids[0]
        Set-StateEntry -ServiceName 'backend' -Entry $backendEntry

        if (-not (Wait-ForHttp -Url $script:BackendHealthUrl -TimeoutSec 60)) {
            throw "Backend health check failed: $script:BackendHealthUrl. See $($backendDefinition.LogFile)"
        }

        if (Wait-ForHttp -Url $script:BackendReadyUrl -TimeoutSec 30) {
            Write-OkLine "Backend readiness check passed: $script:BackendReadyUrl"
        } else {
            Write-WarnLine "Backend readiness endpoint timed out: $script:BackendReadyUrl"
        }

        $statuses['backend'].Status = 'running'
        $statuses['backend'].Message = 'Backend is listening and passed health checks.'
        Write-OkLine 'Backend started.'
    } catch {
        $statuses['backend'].Status = 'failed'
        $statuses['backend'].Message = $_.Exception.Message
        $statuses['frontend'].Status = 'skipped'
        $statuses['frontend'].Message = 'Skipped because backend did not become healthy.'
        Write-ErrorLine $statuses['backend'].Message
        Show-Summary -Statuses $statuses -ModeName 'start-stack'
        exit 1
    }

    try {
        $statuses['frontend'] = Start-Frontend
    } catch {
        $statuses['frontend'].Status = 'failed'
        $statuses['frontend'].Message = $_.Exception.Message
        Write-ErrorLine $statuses['frontend'].Message
        Show-Summary -Statuses $statuses -ModeName 'start-stack'
        exit 1
    }

    Show-Summary -Statuses $statuses -ModeName 'start-stack'

    $allRunning = $true
    foreach ($serviceName in @('dymo', 'backend', 'frontend')) {
        if ($statuses[$serviceName].Status -ne 'running') {
            $allRunning = $false
            break
        }
    }

    if ($allRunning) {
        exit 0
    }

    exit 1
}

function Run-DeployFrontend {
    Write-Header -Title 'Quartzy Frontend Local Deployment (Static)'
    if (-not (Test-CommandAvailable -Name 'npm')) {
        throw 'npm is not available on PATH.'
    }
    if (-not (Test-CommandAvailable -Name 'npx')) {
        throw 'npx is not available on PATH.'
    }

    $statuses = Get-InitialStatuses
    $statuses['dymo'].Message = 'Not part of frontend-only deployment.'
    $statuses['backend'].Message = 'Not part of frontend-only deployment.'

    try {
        $statuses['frontend'] = Start-Frontend -PreserveExistingUntilBuildSucceeds
        Show-Summary -Statuses $statuses -ModeName 'deploy-frontend'
        exit 0
    } catch {
        $statuses['frontend'].Status = 'failed'
        $statuses['frontend'].Message = $_.Exception.Message
        Write-ErrorLine $statuses['frontend'].Message
        Show-Summary -Statuses $statuses -ModeName 'deploy-frontend'
        exit 1
    }
}

Initialize-Environment

try {
    switch ($Action) {
        'start-stack' {
            Run-StartStack
        }
        'deploy-frontend' {
            Run-DeployFrontend
        }
        default {
            throw "Unsupported action: $Action"
        }
    }
} catch {
    Write-ErrorLine $_.Exception.Message
    exit 1
}
