# CI preparation only; do not modify a developer's installed runtime.
$ErrorActionPreference = 'Stop'
if ($env:GITHUB_ACTIONS -ne 'true') { throw 'This installer helper is only for disposable GitHub Actions runners.' }

function Get-BillingWebViewRuntime {
    $roots = @(
        (Join-Path ${env:ProgramFiles(x86)} 'Microsoft\EdgeWebView\Application'),
        (Join-Path $env:ProgramFiles 'Microsoft\EdgeWebView\Application'),
        (Join-Path $env:LOCALAPPDATA 'Microsoft\EdgeWebView\Application')
    )
    foreach ($root in $roots) {
        if (Test-Path -LiteralPath $root) {
            foreach ($directory in Get-ChildItem -LiteralPath $root -Directory) {
                $exe = Join-Path $directory.FullName 'msedgewebview2.exe'
                if ((Test-Path -LiteralPath $exe) -and $directory.Name -match '^\d+\.\d+\.\d+\.\d+$' -and ([version]$directory.Name).Major -ge 120) {
                    return $directory.Name
                }
            }
        }
    }
    return $null
}

$runtimeVersion = Get-BillingWebViewRuntime
if (!$runtimeVersion) {
    $bootstrapper = Join-Path $env:RUNNER_TEMP 'billing-memo-webview2-setup.exe'
    Invoke-WebRequest -Uri 'https://go.microsoft.com/fwlink/p/?LinkId=2124703' -OutFile $bootstrapper
    $signature = Get-AuthenticodeSignature -LiteralPath $bootstrapper
    if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'Microsoft Corporation') {
        throw 'Microsoft WebView2 installer signature verification failed.'
    }
    $install = Start-Process -FilePath $bootstrapper -ArgumentList '/silent', '/install' -WindowStyle Hidden -Wait -PassThru
    if ($install.ExitCode -notin @(0, 3010)) { throw "WebView2 installer failed: $($install.ExitCode)" }
    $runtimeVersion = Get-BillingWebViewRuntime
    if (!$runtimeVersion) { throw 'WebView2 runtime was not found after installation.' }
}
Write-Output "WebView2 runtime ready: $runtimeVersion"
