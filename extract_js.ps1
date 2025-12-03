$content = Get-Content 'd:\Dev\presence_ccrb\web\agent-dashboard.html' -Raw
$start = $content.IndexOf('<script>')
$end = $content.LastIndexOf('</script>')
$js = $content.Substring($start + 8, $end - $start - 8).Trim()
Set-Content 'temp_agent_dashboard.js' -Value $js
