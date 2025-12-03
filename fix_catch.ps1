$content = Get-Content 'd:\Dev\presence_ccrb\web\agent-dashboard.html' -Raw
$content = $content -replace '        \]\);\s+\}', '        ]);\n\n      } catch (error) {\n        console.error("Erreur lors de l''application des filtres:", error);\n        if (!options.suppressAlerts) {\n          alert("Erreur lors de l''application des filtres: " + error.message);\n        }\n      }'
Set-Content 'd:\Dev\presence_ccrb\web\agent-dashboard.html' -Value $content
