$ErrorActionPreference = "Stop"
$TaskName = "小红书飞书聊天机器人"
$ProjectRoot = "C:\Users\Lenovo\Desktop\Codex Agent合集\小红书飞书机器人Agent"
$ScriptPath = Join-Path $ProjectRoot "scripts\windows\start-feishu-bot.ps1"
$Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$ScriptPath`""
$Trigger = New-ScheduledTaskTrigger -AtLogOn
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DisallowStartIfOnBatteries:$false -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Description "Feishu chat entry for XHS content and scan-publish agents." -Force
Write-Host "Installed scheduled task: $TaskName"
