$src = "C:\Users\lucas.jensen\Downloads\resolv-main\apps\agent\node-agent\dist\ResolvAgent.exe"
$dst = "C:\ProgramData\Resolv\Agent\ResolvAgent.exe"
sc.exe stop ResolvAgent
Start-Sleep -Seconds 4
Copy-Item $src $dst -Force
sc.exe start ResolvAgent
