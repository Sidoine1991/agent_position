    async function renderValidations(rows) {
      const tbody = document.getElementById('validations-body');
      if (!tbody) {
        console.error('❌ Élément validations-body non trouvé');
        return;
      }

      console.log('📊 renderValidations appelé avec', rows ? rows.length : 0, 'lignes');

      // Vérifier et normaliser les données
      if (!rows || !Array.isArray(rows)) {
        console.error('❌ Données invalides reçues pour le rendu du tableau');
        tbody.innerHTML = '<tr><td colspan="11" class="text-center text-danger">Erreur: Format de données invalide</td></tr>';
        return;
      }

      if (rows.length === 0) {
        console.warn('⚠️ Aucune donnée à afficher dans le tableau de validation');
        tbody.innerHTML = `<tr><td colspan="11" class="text-center">
          <i class="bi bi-inbox me-2"></i>
          Aucune donnée disponible pour les critères sélectionnés.
          <div class="mt-2 small text-muted">
            Essayez de modifier la période ou les filtres.
          </div>
          <button class="btn btn-sm btn-outline-primary mt-2" onclick="window.diagnoseValidations()">
            <i class="bi bi-bug"></i> Diagnostic
          </button>
        </td></tr>`;
        return;
      }

      console.log('📊 Données reçues pour le rendu:', rows.length, 'lignes');
      if (rows.length > 0) {
        console.log('📝 Exemple de données enrichies (première ligne):', rows[0]);

        // Log détaillé des champs importants pour le débogage
        console.log('🔍 Vérification des champs de la première ligne:', {
          agent: rows[0].agent || rows[0].agent_name,
          localisation: rows[0].localisation,
          departement: rows[0].departement,
          commune: rows[0].commune,
          arrondissement: rows[0].arrondissement,
          village: rows[0].village,
          tolerance_radius_meters: rows[0].tolerance_radius_meters,
          rayon_m: rows[0].rayon_m,
          reference_lat: rows[0].reference_lat,
          reference_lon: rows[0].reference_lon,
          ref_lat: rows[0].ref_lat,
          ref_lon: rows[0].ref_lon,
          lat: rows[0].lat,
          lon: rows[0].lon,
          distance_m: rows[0].distance_m,
          user_object: rows[0].user ? 'présent' : 'absent'
        });
      }

      const cell = v => {
        if (v === null || v === undefined || v === '') return '—';
        return String(v).trim();
      };

      const fmt = d => {
        try {
          if (!d) return '—';
          const date = new Date(d);
          if (isNaN(date.getTime())) return '—';
          return date.toLocaleString('fr-FR');
        } catch (e) {
          console.warn('Erreur de formatage de date:', d, e);
          return '—';
        }
      };

      // Clear previous content
      tbody.innerHTML = '';

      // Create rows and append them
      for (const it of rows) {
        try {
          const tr = document.createElement('tr');

          // Agent - depuis users.name
          const agentName = cell(
            it.agent_name || 
            it.agent || 
            it.name || 
            (it.user ? it.user.name : null) || 
            '—'
          );

          // Projet - depuis users.project_name
          const projectName = cell(
            it.project_name || 
            it.projet || 
            (it.user ? it.user.project_name : null) || 
            '—'
          );

          // Localisation - combinaison de departement, commune, arrondissement, village
          const location = (() => {
            // Priorité 1 : localisation pré-formatée complète
            if (it.localisation && it.localisation.includes(',')) {
              return it.localisation;
            }

            // Priorité 2 : construire depuis les champs individuels
            const parts = [];
            if (it.departement) parts.push(it.departement);
            if (it.commune) parts.push(it.commune);
            if (it.arrondissement) parts.push(it.arrondissement);
            if (it.village) parts.push(it.village);

            if (parts.length > 0) return parts.join(', ');

            // Priorité 3 : essayer depuis l'objet user
            if (it.user) {
              const userParts = [];
              if (it.user.departement) userParts.push(it.user.departement);
              if (it.user.commune) userParts.push(it.user.commune);
              if (it.user.arrondissement) userParts.push(it.user.arrondissement);
              if (it.user.village) userParts.push(it.user.village);
              if (userParts.length > 0) return userParts.join(', ');
            }

            // Priorité 4 : au moins le département si disponible
            if (it.localisation) return it.localisation;
            if (it.departement) return it.departement;

            return '—';
          })();

          // Formater la localisation sur plusieurs lignes pour l'affichage
          const locationLines = [];
          if (it.departement) locationLines.push(it.departement);
          if (it.commune) locationLines.push(it.commune);
          if (it.arrondissement) locationLines.push(it.arrondissement);
          if (it.village) locationLines.push(it.village);
          const locationHTML = locationLines.length > 0 
            ? locationLines.join('<br>') 
            : location;

          // Rayon - depuis users.tolerance_radius_meters avec fallbacks multiples
          const radiusValue = 
            it.tolerance_radius_meters ?? 
            it.rayon_m ?? 
            it.tolerance_m ??
            (it.user ? it.user.tolerance_radius_meters : null);

          const radius = radiusValue != null ? String(radiusValue) : '—';

          // Coordonnées de référence - depuis users.reference_lat et reference_lon
          const refLat = 
            it.reference_lat ?? 
            it.ref_lat ?? 
            (it.user ? it.user.reference_lat : null);

          const refLon = 
            it.reference_lon ?? 
            it.ref_lon ?? 
            (it.user ? it.user.reference_lon : null);

          const refCoords = (refLat != null && refLon != null) ? 
                            `${Number(refLat).toFixed(5)}, ${Number(refLon).toFixed(5)}` : '—';

          // Coordonnées actuelles - depuis la validation avec tous les alias possibles
          const actualLat = 
            it.lat ?? 
            it.latitude ?? 
            it.current_lat ?? 
            it.location_lat ??
            (it.checkin_lat !== undefined ? it.checkin_lat : null);

          const actualLon = 
            it.lon ?? 
            it.longitude ?? 
            it.current_lon ?? 
            it.location_lng ??
            (it.checkin_lng !== undefined ? it.checkin_lng : null);

          const actualCoords = (actualLat != null && actualLon != null) ? 
                               `${Number(actualLat).toFixed(5)}, ${Number(actualLon).toFixed(5)}` : '—';

          // Date
          const date = it.date || it.created_at || it.ts || it.timestamp || it.checkin_timestamp || null;
          const formattedDate = fmt(date);

          // Distance - calculer si non fournie
          let distance = 
            it.distance_m ?? 
            it.distance_from_reference_m ?? 
            it.distance ?? 
            null;

          // Si la distance n'est pas fournie mais que nous avons toutes les coordonnées, la calculer
          if (distance == null && refLat != null && refLon != null && actualLat != null && actualLon != null) {
            distance = calculateDistance(refLat, refLon, actualLat, actualLon);
            if (distance != null) {
              console.log(`📏 Distance calculée pour ${it.agent || 'agent'}: ${distance}m`);
            }
          }

          const distanceDisplay = distance != null ? String(distance) : '—';

          // Statut
          let status = '—';
          let statusClass = 'bg-secondary';

          if (it.statut) {
            status = it.statut;
          } else if (it.valid === true || it.within_tolerance === true) {
            status = 'Présent';
          } else if (it.valid === false || it.within_tolerance === false) {
            status = 'Absent';
          } else if (it.status) {
            status = it.status;
          }

          // Déterminer la classe CSS du badge
          if (status.toLowerCase().includes('présent') || status.toLowerCase() === 'valide') {
            statusClass = 'bg-success';
          } else if (status.toLowerCase().includes('absent') || status.toLowerCase().includes('hors')) {
            statusClass = 'bg-danger';
          }

          // Vérifier si l'utilisateur a une planification
          const isPlanified = it.planifie === 'Oui' || it.planifie === true || it.planified === true;
          const planificationIcon = isPlanified 
            ? '<i class="bi bi-check-circle-fill text-success"></i> Oui' 
            : '<i class="bi bi-x-circle text-muted"></i> Non';

          // Identifiant unique pour les observations
          const rowId = it.id || `${it.agent_id || it.user_id}_${Date.now()}_${Math.random()}`;
          const savedObservation = localStorage.getItem(`validation_observation_${rowId}`) || '';

          // Construction des cellules avec le nouveau format
          tr.innerHTML = `
            <td>${agentName}</td>
            <td>${projectName}</td>
            <td style="line-height: 1.4;">${locationHTML}</td>
            <td class="text-center">${radius}</td>
            <td class="text-center" style="font-family: monospace; font-size: 0.85em;">${refCoords}</td>
            <td class="text-center" style="font-family: monospace; font-size: 0.85em;">${actualCoords}</td>
            <td class="text-center">${formattedDate}</td>
            <td class="text-center"><strong>${distanceDisplay}</strong></td>
            <td class="text-center"><span class="badge ${statusClass}">${status}</span></td>
            <td class="text-center">${planificationIcon}</td>
            <td>
              <input type="text" 
                     class="form-control form-control-sm validation-observation" 
                     data-row-id="${rowId}"
                     placeholder="..."
                     value="${savedObservation.replace(/"/g, '&quot;')}"
                     style="min-width: 150px; font-size: 0.85em;">
            </td>
          `;
          tbody.appendChild(tr);
        } catch (error) {
          console.error('Erreur lors du rendu d\'une ligne de validation:', error, 'Données:', it);
          const tr = document.createElement('tr');
          tr.innerHTML = `<td colspan="11" class="text-danger">Erreur d'affichage pour une ligne - Voir la console</td>`;
          tbody.appendChild(tr);
        }
      }

      // Ajouter les event listeners pour sauvegarder les observations
      tbody.querySelectorAll('.validation-observation').forEach(input => {
        input.addEventListener('blur', function() {
          const rowId = this.getAttribute('data-row-id');
          const observation = this.value.trim();
          const key = `validation_observation_${rowId}`;

          if (observation) {
            localStorage.setItem(key, observation);
            console.log(`💾 Observation sauvegardée pour la validation ${rowId}`);
          } else {
            localStorage.removeItem(key);
          }
        });

        // Sauvegarder aussi lors de la pression de Enter
        input.addEventListener('keydown', function(e) {
          if (e.key === 'Enter') {
            e.preventDefault();
            this.blur();
          }
        });
      });

      console.log('✅ Tableau de validation rendu avec', rows.length, 'lignes');
      window.__lastRows = rows;
    }
