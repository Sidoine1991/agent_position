$content = Get-Content 'd:\Dev\presence_ccrb\web\agent-dashboard.html' -Raw
$content = $content -replace '        \]\);\\n\\n      \} catch \(error\) \{\\n        console\.error\("Erreur lors de l''application des filtres:", error\);\\n        if \(!options\.suppressAlerts\) \{\\n          alert\("Erreur lors de l''application des filtres: " \+ error\.message\);\\n        \}\\n      \}', '        ]);

      } catch (error) {
        console.error("Erreur lors de l''application des filtres:", error);
        if (!options.suppressAlerts) {
          alert("Erreur lors de l''application des filtres: " + error.message);
        }
      }'
Set-Content 'd:\Dev\presence_ccrb\web\agent-dashboard.html' -Value $content
