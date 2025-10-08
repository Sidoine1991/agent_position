// Version simplifiée et corrigée de loadCheckinsOnMap()
async function loadCheckinsOnMap() {
  try {
    console.log('🗺️ Chargement des check-ins existants pour la carte...');
    
    let rows = [];
    
    // Essayer d'abord l'endpoint admin pour tous les agents
    try {
      console.log('📍 Récupération des check-ins de tous les agents...');
      const response = await api('/admin/checkins/latest');
      console.log('📦 Réponse admin checkins:', response);
      
      const checkins = response?.data?.items || response?.checkins || [];
      console.log('📋 Check-ins extraits:', checkins.length);
      
      if (Array.isArray(checkins) && checkins.length > 0) {
        // Traiter les check-ins de l'endpoint admin
        rows = checkins
          .filter(checkin => {
            const hasCoords = Number.isFinite(Number(checkin.lat)) && Number.isFinite(Number(checkin.lon));
            console.log(`🔍 Check-in ${checkin.id}: coordonnées valides =`, hasCoords, `(${checkin.lat}, ${checkin.lon})`);
            return hasCoords;
          })
          .map(checkin => {
            console.log('🔍 Traitement check-in pour la carte:', checkin);
            const agentName = checkin.missions?.users?.name || 'Agent';
            return {
              lat: Number(checkin.lat),
              lon: Number(checkin.lon),
              timestamp: checkin.timestamp || checkin.created_at,
              agent_name: agentName,
              user_id: checkin.missions?.agent_id || checkin.mission_id,
              type: 'checkin',
              note: `Check-in ${checkin.id} - ${agentName}${checkin.note ? `: ${checkin.note}` : ''}`
            };
          });
        console.log('✅ Check-ins admin traités:', rows.length);
      }
    } catch (adminError) {
      console.log('⚠️ Endpoint admin non disponible, fallback vers check-ins utilisateur');
      
      // Fallback: récupérer les check-ins de l'utilisateur connecté
      try {
        const userCheckinsResp = await api('/checkins/mine');
        const userCheckins = userCheckinsResp?.items || [];
        console.log('📋 Check-ins utilisateur récupérés:', userCheckins.length);
        
        rows = userCheckins
          .filter(checkin => {
            const hasCoords = Number.isFinite(Number(checkin.lat)) && Number.isFinite(Number(checkin.lon));
            return hasCoords;
          })
          .map(checkin => ({
            lat: Number(checkin.lat),
            lon: Number(checkin.lon),
            timestamp: checkin.timestamp,
            agent_name: currentProfile?.name || 'Moi',
            user_id: currentProfile?.id,
            type: 'checkin',
            note: `Check-in ${checkin.id}${checkin.note ? `: ${checkin.note}` : ''}`
          }));
        console.log('✅ Check-ins utilisateur traités:', rows.length);
      } catch (userError) {
        console.error('❌ Erreur récupération check-ins utilisateur:', userError);
      }
    }
    
    // Afficher les check-ins sur la carte
    if (rows && rows.length > 0) {
      console.log('✅ Check-ins chargés pour affichage sur carte:', rows.length);
      console.log('Données check-ins:', rows);
      
      // Clear existing markers
      if (basemapType === 'google') {
        clearGoogleMarkers();
        console.log('🧹 Marqueurs Google Maps nettoyés');
      } else {
        checkinMarkers.forEach(marker => { 
          try { map.removeLayer(marker); } catch {} 
        });
        checkinMarkers = [];
        console.log('🧹 Marqueurs Leaflet nettoyés');
      }

      const latlngs = [];
      rows.forEach((checkin, index) => {
        console.log(`🔍 Traitement check-in ${index + 1}:`, checkin);
        if (typeof checkin.lat === 'number' && typeof checkin.lon === 'number') {
          latlngs.push([checkin.lat, checkin.lon]);
          
          // Créer le marqueur selon le type de carte
          if (basemapType === 'google' && gmap) {
            const marker = new google.maps.Marker({
              position: { lat: checkin.lat, lng: checkin.lon },
              map: gmap,
              title: checkin.note,
              icon: {
                url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                  <svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="10" cy="10" r="8" fill="${colorForAgentName(checkin.agent_name)}" stroke="white" stroke-width="2"/>
                  </svg>
                `),
                scaledSize: new google.maps.Size(20, 20)
              }
            });
            gmarkers.push(marker);
          } else if (map) {
            const marker = L.marker([checkin.lat, checkin.lon], {
              icon: L.divIcon({
                className: 'checkin-marker',
                html: `<div style="background: ${colorForAgentName(checkin.agent_name)}; width: 15px; height: 15px; border-radius: 50%; border: 2px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.3);"></div>`,
                iconSize: [15, 15],
                iconAnchor: [7, 7]
              })
            }).addTo(map);
            
            marker.bindPopup(`
              <b>${checkin.agent_name}</b><br>
              ${checkin.note}<br>
              <small>${new Date(checkin.timestamp).toLocaleString('fr-FR')}</small>
            `);
            
            checkinMarkers.push(marker);
          }
        }
      });
      
      // Centrer la carte sur les marqueurs
      if (latlngs.length > 0) {
        if (basemapType === 'google' && gmap) {
          const bounds = new google.maps.LatLngBounds();
          latlngs.forEach(latlng => bounds.extend(new google.maps.LatLng(latlng[0], latlng[1])));
          gmap.fitBounds(bounds);
          console.log('✅ Carte Google Maps centrée');
        } else if (map) {
          const group = new L.featureGroup(checkinMarkers);
          map.fitBounds(group.getBounds().pad(0.1));
          console.log('✅ Carte Leaflet centrée');
        }
      } else {
        console.warn('⚠️ Aucun point à afficher sur la carte');
      }
      
      console.log(`✅ Carte mise à jour avec ${latlngs.length} marqueurs (${checkinMarkers.length} Leaflet, ${gmarkers?.length || 0} Google)`);
    } else {
      console.warn('⚠️ Aucun check-in trouvé à afficher');
    }
    
  } catch (error) {
    console.error('❌ Erreur lors du chargement des check-ins:', error);
    handleDashboardError(error);
  }
}

// Fonction pour obtenir une couleur basée sur le nom de l'agent
function colorForAgentName(agentName) {
  const colors = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#e11d48', '#9333ea', '#84cc16', '#06b6d4'];
  let hash = 0;
  for (let i = 0; i < agentName.length; i++) {
    hash = agentName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

console.log('✅ Fonction loadCheckinsOnMap() simplifiée chargée');
