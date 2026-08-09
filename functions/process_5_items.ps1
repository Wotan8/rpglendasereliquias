$items = @(
    @("C:\Users\Soberano\.gemini\antigravity\brain\109cdc47-385e-44dc-8c3c-894a32dc8518\aconito_1786220097542.jpg", "Acônito"),
    @("C:\Users\Soberano\.gemini\antigravity\brain\109cdc47-385e-44dc-8c3c-894a32dc8518\agulhas_rituais_1786220107830.jpg", "Agulhas Rituais"),
    @("C:\Users\Soberano\.gemini\antigravity\brain\109cdc47-385e-44dc-8c3c-894a32dc8518\alaude_classico_1786220115870.jpg", "Alaúde Clássico"),
    @("C:\Users\Soberano\.gemini\antigravity\brain\109cdc47-385e-44dc-8c3c-894a32dc8518\aljava_de_caca_1786220124253.jpg", "Aljava de Caça"),
    @("C:\Users\Soberano\.gemini\antigravity\brain\109cdc47-385e-44dc-8c3c-894a32dc8518\aljava_virotes_1786220133100.jpg", "Aljava Virotes")
)

Set-Location "c:\Users\Soberano\Documents\rpglendasereliquias\functions"

foreach ($item in $items) {
    $src = $item[0]
    $name = $item[1]
    $dest = "avulsos-imagens\$name.png"
    
    Write-Host "Processando $name..."
    Copy-Item $src $dest -Force
    python ../functions/remove-bg.py $dest
    node upload-and-update.mjs $dest "system/data/equipment" $name
}
