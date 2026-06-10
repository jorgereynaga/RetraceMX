param(
    [string]$BackendUrl = "http://localhost:8001",
    [string]$Username = "admin",
    [string]$Password = "Admin1234!",
    [string]$DeviceIdentifier = "STD-21X3-COM5",
    [string]$DeviceName = "Bascula STD-21X3",
    [string]$DeviceKind = "vehicle_scale",
    [string]$Port = "COM5",
    [int]$BaudRate = 9600,
    [int]$TimeoutMs = 1500,
    [int]$PollIntervalMs = 1000,
    [switch]$Once
)

$ErrorActionPreference = "Stop"

function Join-Url {
    param([string]$Base, [string]$Path)
    return ($Base.TrimEnd("/") + "/" + $Path.TrimStart("/"))
}

function Invoke-JsonApi {
    param(
        [ValidateSet("Get", "Post", "Patch")][string]$Method,
        [string]$Url,
        [string]$Token,
        [hashtable]$Payload
    )

    $headers = @{ Accept = "application/json" }
    if ($Token) {
        $headers["Authorization"] = "Token $Token"
    }

    if ($Method -eq "Get") {
        return Invoke-RestMethod -Method Get -Uri $Url -Headers $headers
    }

    $body = if ($Payload) { ($Payload | ConvertTo-Json -Depth 10) } else { "{}" }
    $headers["Content-Type"] = "application/json"
    return Invoke-RestMethod -Method $Method -Uri $Url -Headers $headers -Body $body
}

function Get-AuthToken {
    param([string]$Url, [string]$User, [string]$Pass)
    $payload = @{ username = $User; password = $Pass }
    $response = Invoke-JsonApi -Method "Post" -Url (Join-Url $Url "/api/auth/login/") -Payload $payload
    return $response.token
}

function Get-ScaleReadingState {
    param([string]$Raw)

    $text = if ([string]::IsNullOrWhiteSpace($Raw)) { "" } else { $Raw.Trim() }
    $normalized = $text.ToUpperInvariant()

    $disconnectedMarkers = @(
        "DISCONNECTED",
        "NO SIGNAL",
        "NO CONNECTION",
        "TIMEOUT",
        "OFFLINE",
        "PORT CLOSED",
        "ERROR",
        "SCALE OFF"
    )
    foreach ($marker in $disconnectedMarkers) {
        if ($normalized.Contains($marker)) {
            return @{
                raw_value = $text
                is_stable = $false
                disconnected = $true
                weight_kg = $null
            }
        }
    }

    $unstableMarkers = @("UNSTABLE", "MOVING", "MOTION", "WAIT", "WOBBLE")
    $isStable = $true
    foreach ($marker in $unstableMarkers) {
        if ($normalized.Contains($marker)) {
            $isStable = $false
            break
        }
    }

    $weight = $null
    if ($text -match '[-+]?\d+(?:[.,]\d+)?') {
        $candidate = $Matches[0] -replace ',', '.'
        try {
            $weight = [decimal]::Parse($candidate, [System.Globalization.CultureInfo]::InvariantCulture)
        } catch {
            $weight = $null
        }
    }

    return @{
        raw_value = $text
        is_stable = $isStable
        disconnected = $false
        weight_kg = $weight
    }
}

function Ensure-Device {
    param(
        [string]$Url,
        [string]$Token,
        [string]$Identifier,
        [string]$Name,
        [string]$Kind,
        [string]$PortName,
        [int]$Baud,
        [int]$Timeout
    )

    $devices = Invoke-JsonApi -Method "Get" -Url (Join-Url $Url "/api/devices/") -Token $Token
    if ($devices.results) {
        $items = $devices.results
    } elseif ($devices -is [System.Collections.IEnumerable]) {
        $items = $devices
    } else {
        $items = @()
    }

    $metadata = @{
        bridge_mode = $true
        bridge_enabled = $true
        baudrate = $Baud
        timeout = ($Timeout / 1000.0)
        cache_seconds = 12
    }

    $existing = $items | Where-Object { $_.identifier -eq $Identifier } | Select-Object -First 1
    $payload = @{
        name = $Name
        identifier = $Identifier
        kind = $Kind
        port = $PortName
        is_connected = $true
        is_stable = $true
        is_manual_fallback = $false
        metadata = $metadata
    }

    if ($existing) {
        return Invoke-JsonApi -Method "Patch" -Url (Join-Url $Url "/api/devices/$($existing.id)/") -Token $Token -Payload $payload
    }

    return Invoke-JsonApi -Method "Post" -Url (Join-Url $Url "/api/devices/") -Token $Token -Payload $payload
}

function Get-DeviceState {
    param(
        [string]$Url,
        [string]$Token,
        [string]$DeviceId
    )

    return Invoke-JsonApi -Method "Get" -Url (Join-Url $Url "/api/devices/$DeviceId/") -Token $Token
}

function Post-Reading {
    param(
        [string]$Url,
        [string]$Token,
        [string]$DeviceId,
        [hashtable]$Payload
    )

    return Invoke-JsonApi -Method "Post" -Url (Join-Url $Url "/api/devices/$DeviceId/ingest_scale/") -Token $Token -Payload $Payload
}

Write-Host "Connecting to backend at $BackendUrl ..."
$token = Get-AuthToken -Url $BackendUrl -User $Username -Pass $Password
$device = Ensure-Device -Url $BackendUrl -Token $token -Identifier $DeviceIdentifier -Name $DeviceName -Kind $DeviceKind -PortName $Port -Baud $BaudRate -Timeout $TimeoutMs

Write-Host "Reading scale on $Port and posting to backend."
Write-Host "Press Ctrl+C to stop."

$serialPort = New-Object System.IO.Ports.SerialPort $Port, $BaudRate, "None", 8, "One"
$serialPort.ReadTimeout = $TimeoutMs
$serialPort.NewLine = "`n"

try {
    $serialPort.Open()
    $wasPaused = $false

    while ($true) {
        try {
            $deviceState = Get-DeviceState -Url $BackendUrl -Token $token -DeviceId $device.id
            $bridgeEnabled = $true
            if ($deviceState.metadata -and ($deviceState.metadata.PSObject.Properties.Name -contains "bridge_enabled")) {
                $bridgeEnabled = [bool]$deviceState.metadata.bridge_enabled
            }

            if (-not $bridgeEnabled) {
                if (-not $wasPaused) {
                    Write-Host "Bridge paused by UI. Waiting for resume..."
                    $wasPaused = $true
                }
                Start-Sleep -Milliseconds $PollIntervalMs
                continue
            }

            if ($wasPaused) {
                Write-Host "Bridge resumed by UI."
                $wasPaused = $false
            }

            $raw = $serialPort.ReadLine()
        } catch [System.TimeoutException] {
            if ($Once) {
                Write-Host "No scale reading received on the first attempt."
                exit 2
            }
            Start-Sleep -Milliseconds $PollIntervalMs
            continue
        }

        $state = Get-ScaleReadingState -Raw $raw
        $payload = @{
            weight_kg = if ($null -ne $state.weight_kg) { $state.weight_kg.ToString([System.Globalization.CultureInfo]::InvariantCulture) } else { $null }
            raw_value = $state.raw_value
            is_stable = $state.is_stable
            is_manual = $false
            disconnected = $state.disconnected
            source = "bridge"
            captured_at = [DateTimeOffset]::UtcNow.ToString("o")
            notes = "Live reading from $Port"
            reading_type = "direct"
        }

        $stored = Post-Reading -Url $BackendUrl -Token $token -DeviceId $device.id -Payload $payload
        Write-Host ("[{0}] {1} weight={2} stable={3} disconnected={4} raw={5}" -f $stored.captured_at, $stored.device_name, $stored.weight_kg, $stored.is_stable, $stored.disconnected, $stored.raw_value)

        if ($Once) {
            exit 0
        }
    }
}
catch {
    Write-Error "Scale bridge error: $($_.Exception.Message)"
    exit 1
}
finally {
    if ($serialPort.IsOpen) {
        $serialPort.Close()
    }
    $serialPort.Dispose()
}
