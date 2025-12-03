$content = Get-Content 'd:\Dev\presence_ccrb\web\agent-dashboard.html' -Raw
# Trouver le premier script principal (le plus grand)
$pattern = '(?s)<script[^>]*>(.*?)</script>'
$matches = [regex]::Matches($content, $pattern)

# Prendre le match le plus long (probablement le script principal)
$longestMatch = $matches | Sort-Object Length -Descending | Select-Object -First 1
$js = $longestMatch.Groups[1].Value.Trim()

# Nettoyer le début pour s'assurer qu'il n'y a pas de HTML
if ($js.StartsWith('>')) {
    $js = $js.Substring(1).Trim()
}

Set-Content 'temp_agent_dashboard_clean.js' -Value $js
