param(
    [string]$InputFile,
    [string]$PdfFile
)
$ErrorActionPreference = 'Stop'
$sourcePath = (Resolve-Path -LiteralPath $InputFile).Path
$pdfPath = [System.IO.Path]::GetFullPath($PdfFile)
$pdfDirectory = [System.IO.Path]::GetDirectoryName($pdfPath)
[System.IO.Directory]::CreateDirectory($pdfDirectory) | Out-Null
$wordApp = $null
$wordDocument = $null
try {
    $wordApp = New-Object -ComObject Word.Application
    $wordApp.Visible = $false
    $wordApp.DisplayAlerts = 0
    $wordApp.AutomationSecurity = 3
    $wordApp.Options.UpdateLinksAtOpen = $false
    $wordDocument = $wordApp.Documents.Open($sourcePath, $false, $true, $false)
    $wordDocument.Repaginate()
    $pageCount = $wordDocument.ComputeStatistics(2)
    $wordDocument.ExportAsFixedFormat($pdfPath, 17)
    [pscustomobject]@{pdf = $pdfPath; pages = $pageCount} | ConvertTo-Json -Compress
} finally {
    if ($null -ne $wordDocument) {
        $wordDocument.Close(0)
        [System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($wordDocument) | Out-Null
    }
    if ($null -ne $wordApp) {
        $wordApp.Quit(0)
        [System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($wordApp) | Out-Null
    }
}
