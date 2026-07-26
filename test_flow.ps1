# Script de Teste Automatizado das APIs do Checkout TV-Pix (ISPFY)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "INICIANDO TESTE DO FLUXO COMPLETO DO SISTEMA (ISPFY)" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$baseUrl = "http://localhost:3000"

# 1. Testando Cadastro e Geração de Pix
Write-Host "`n1. Enviando cadastro de cliente..." -ForegroundColor Yellow
$cadastroBody = @{
    nome = "Thiago Leite Teste"
    email = "thiago.leite.test@example.com"
    telefone = "5511987654321"
} | ConvertTo-Json

$cadastroRes = Invoke-RestMethod -Uri "$baseUrl/api/cadastro" -Method Post -Body $cadastroBody -ContentType "application/json"

if ($cadastroRes.status -eq "pending") {
    $txid = $cadastroRes.txid
    Write-Host "Sucesso! Cobrança Pix gerada com sucesso." -ForegroundColor Green
    Write-Host "TXID do Pix: $txid" -ForegroundColor Gray
    Write-Host "Pix Copia e Cola: $($cadastroRes.copiaCola.Substring(0, 50))..." -ForegroundColor Gray
} else {
    Write-Host "Falha ao gerar cobrança: $($cadastroRes | Out-String)" -ForegroundColor Red
    Exit
}

# 2. Verificando Status (Deve estar Pendente)
Write-Host "`n2. Verificando status inicial do Pix..." -ForegroundColor Yellow
$statusRes1 = Invoke-RestMethod -Uri "$baseUrl/api/status/$txid" -Method Get
Write-Host "Status atual: $($statusRes1.status)" -ForegroundColor Gray

if ($statusRes1.status -ne "pendente") {
    Write-Host "Erro: O status deveria ser 'pendente'." -ForegroundColor Red
    Exit
}


# 3. Simulando Confirmação do Pagamento Pix
Write-Host "`n3. Simulando confirmação do pagamento no Pix..." -ForegroundColor Yellow
$simularBody = @{ txid = $txid } | ConvertTo-Json
$simularRes = Invoke-RestMethod -Uri "$baseUrl/api/simular-pagamento" -Method Post -Body $simularBody -ContentType "application/json"

Write-Host "Mensagem: $($simularRes.message)" -ForegroundColor Green
Write-Host "Credenciais geradas no ISPFY:" -ForegroundColor Gray
Write-Host " -> Usuário TV: $($simularRes.login)" -ForegroundColor Gray
Write-Host " -> Senha TV:   $($simularRes.senha)" -ForegroundColor Gray

# 4. Verificando Status Pós-Pagamento (Deve estar Pago)
Write-Host "`n4. Verificando status pós-pagamento..." -ForegroundColor Yellow
$statusRes2 = Invoke-RestMethod -Uri "$baseUrl/api/status/$txid" -Method Get
Write-Host "Status local atual: $($statusRes2.status)" -ForegroundColor Green
Write-Host "Credenciais retornadas: Login=$($statusRes2.login) | Senha=$($statusRes2.senha)" -ForegroundColor Gray

# 5. Simulando Alerta de Vencimento Próximo (3 dias antes)
Write-Host "`n5. Simulando aproximação de vencimento (falta 2 dias)..." -ForegroundColor Yellow
$expiringRes = Invoke-RestMethod -Uri "$baseUrl/api/admin/force-expiring" -Method Post
Write-Host "Mensagem do Admin: $($expiringRes.message)" -ForegroundColor Gray

Write-Host "Executando o Cron de checagem..." -ForegroundColor Yellow
$cronRes1 = Invoke-RestMethod -Uri "$baseUrl/api/admin/run-cron" -Method Post
Write-Host "Status do Cron: $($cronRes1.message)" -ForegroundColor Green
Write-Host "Verifique os logs do servidor para certificar que o alerta no WhatsApp foi enviado." -ForegroundColor Gray

# 6. Simulando Assinatura Vencida (Venceu ontem)
Write-Host "`n6. Simulando expiração total da assinatura (vencida ontem)..." -ForegroundColor Yellow
$expiredRes = Invoke-RestMethod -Uri "$baseUrl/api/admin/force-expired" -Method Post
Write-Host "Mensagem do Admin: $($expiredRes.message)" -ForegroundColor Gray

Write-Host "Executando o Cron de checagem..." -ForegroundColor Yellow
$cronRes2 = Invoke-RestMethod -Uri "$baseUrl/api/admin/run-cron" -Method Post
Write-Host "Status do Cron: $($cronRes2.message)" -ForegroundColor Green
Write-Host "Verifique os logs do servidor para certificar que o bloqueio no ISPFY e alerta de suspensão no WhatsApp foram acionados." -ForegroundColor Gray

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host "TESTE FINALIZADO!" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
