# Rate Limiting Test Script
# Tests CSRF protection and rate limiting

$baseUrl = "http://localhost:5112"
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "S-Store Rate Limiting Test" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Get CSRF Token (stores cookie automatically in session)
Write-Host "Step 1: Fetching CSRF Token..." -ForegroundColor Cyan
try {
    $csrfResponse = Invoke-WebRequest -Uri "$baseUrl/api/csrf-token" `
        -Method GET `
        -WebSession $session

    $csrf = ($csrfResponse.Content | ConvertFrom-Json).token
    
    Write-Host "  ✓ CSRF Token received: $($csrf.Substring(0, 20))..." -ForegroundColor Green
    Write-Host "  ✓ Cookies in session: $($session.Cookies.Count)" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "  ✗ Failed to get CSRF token: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# 2. Test Rate Limiting with correct cookies
Write-Host "Step 2: Testing Rate Limiting (expecting 5 attempts, then block)..." -ForegroundColor Cyan
Write-Host ""

$attempts = 0
$blocked = 0
$unauthorized = 0

1..7 | ForEach-Object {
    $attemptNum = $_
    try {
        $response = Invoke-RestMethod -Uri "$baseUrl/auth/login" `
            -Method POST `
            -ContentType "application/json" `
            -Headers @{"X-XSRF-TOKEN"=$csrf} `
            -Body '{"username":"testuser","password":"WrongPassword123!","rememberMe":false}' `
            -WebSession $session
        
        Write-Host "  Attempt ${attemptNum}: $($response.error)" -ForegroundColor Yellow
        $attempts++
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        
        if ($statusCode -eq 429) {
            Write-Host "  Attempt ${attemptNum}: RATE LIMITED (429) ✓✓✓" -ForegroundColor Green
            $blocked++
        } elseif ($statusCode -eq 401) {
            Write-Host "  Attempt ${attemptNum}: Unauthorized (Invalid credentials) ✓" -ForegroundColor Yellow
            $unauthorized++
        } else {
            $errorBody = ""
            try {
                $errorBody = $_.ErrorDetails.Message
            } catch {}
            Write-Host "  Attempt ${attemptNum}: Error $statusCode - $errorBody" -ForegroundColor Red
        }
        $attempts++
    }
    
    # Small delay between requests
    Start-Sleep -Milliseconds 100
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Test Results Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Total Attempts:      $attempts" -ForegroundColor White
Write-Host "Unauthorized (401):  $unauthorized" -ForegroundColor Yellow
Write-Host "Rate Limited (429):  $blocked" -ForegroundColor $(if ($blocked -ge 2) { "Green" } else { "Red" })
Write-Host ""

if ($blocked -ge 2 -and $unauthorized -ge 4) {
    Write-Host "✓✓✓ RATE LIMITING WORKS PERFECTLY!" -ForegroundColor Green
    Write-Host "  • First 4-5 attempts: Invalid credentials (expected)" -ForegroundColor Green
    Write-Host "  • After that: Rate limited (expected)" -ForegroundColor Green
} elseif ($blocked -ge 1) {
    Write-Host "✓ Rate limiting is active but may need adjustment" -ForegroundColor Yellow
} else {
    Write-Host "✗ Rate limiting may not be working correctly" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "CSRF Protection Test" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 3. Test CSRF Protection (request without token should fail)
Write-Host "Step 3: Testing CSRF Protection (request without token)..." -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/auth/login" `
        -Method POST `
        -ContentType "application/json" `
        -Body '{"username":"test","password":"test","rememberMe":false}' `
        -WebSession $session
    
    Write-Host "  ✗ Request succeeded without CSRF token - SECURITY ISSUE!" -ForegroundColor Red
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 400) {
        Write-Host "  ✓✓✓ CSRF PROTECTION WORKS!" -ForegroundColor Green
        Write-Host "      Request without token rejected with 400 Bad Request" -ForegroundColor Green
    } else {
        Write-Host "  ? Unexpected status code: $statusCode" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Test completed successfully!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan