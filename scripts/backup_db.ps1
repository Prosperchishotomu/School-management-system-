# Automated MySQL Database Backup Script for SchoolBase
param(
    [string]$BackupDir = "backups",
    [string]$MysqlDumpPath = "C:\wamp64\bin\mysql\mysql8.4.7\bin\mysqldump.exe",
    [string]$DbUser = "root",
    [string]$DbPass = "",
    [string]$DbName = "schoolbase"
)

$dateStr = Get-Date -Format "yyyyMMdd_HHmmss"
if (!(Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
}

$backupFile = Join-Path $BackupDir "schoolbase_backup_$dateStr.sql"
Write-Host "Starting automated backup of '$DbName' to '$backupFile'..." -ForegroundColor Cyan

if (Test-Path $MysqlDumpPath) {
    & $MysqlDumpPath --user=$DbUser --password=$DbPass $DbName --result-file=$backupFile
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Database backup created successfully: $backupFile" -ForegroundColor Green
    } else {
        Write-Host "Database backup failed with exit code: $LASTEXITCODE" -ForegroundColor Red
    }
} else {
    Write-Host "mysqldump.exe not found at path: $MysqlDumpPath" -ForegroundColor Yellow
}
