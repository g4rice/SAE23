// recupinfoville.js

document.getElementById("weatherForm").addEventListener("submit", async function (e) {
  e.preventDefault();

  const villeInput = document.getElementById("ville").value.trim();
  const infos = Array.from(
    document.querySelectorAll('input[name="infos"]:checked')
  ).map(cb => cb.value);
  const nbJours = parseInt(document.getElementById("jours").value, 10);

  if (!villeInput) {
    alert("Veuillez saisir un nom de ville ou un code postal.");
    return;
  }

  const estCodePostal = /^[0-9]{5}$/.test(villeInput);
  let urlGeo;

  if (estCodePostal) {
    urlGeo = `https://geo.api.gouv.fr/communes?codePostal=${villeInput}&fields=nom,centre,codesPostaux&format=json&geometry=centre`;
  } else {
    urlGeo = `https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(villeInput)}&fields=nom,centre,codesPostaux&format=json&geometry=centre`;
  }

  try {
    const response = await fetch(urlGeo);
    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      document.getElementById("commune-name").innerText = "Commune non trouvée.";
      document.getElementById("loader").classList.add("hidden");
      clearMapAndForecast();
      return;
    }

    // Choisir la première commune avec coordonnées valides
    const commune = data.find(c => c.centre && c.centre.coordinates);
    if (!commune) {
      document.getElementById("commune-name").innerText = "Commune sans coordonnées.";
      clearMapAndForecast();
      return;
    }

    // Extraire latitude et longitude (4 décimales)
    const lat = commune.centre.coordinates[1].toFixed(4);
    const lon = commune.centre.coordinates[0].toFixed(4);

    // Récupérer le code postal (le premier si plusieurs)
    const cp = Array.isArray(commune.codesPostaux) && commune.codesPostaux.length > 0
      ? commune.codesPostaux[0]
      : "";

    // Afficher le nom de la commune + son code postal
    document.getElementById("commune-name").innerText = `${commune.nom}${cp ? ", " + cp : ""}`;

    // ===== NOUVEAU : Gestion de l’affichage de la latitude/longitude =====
    const coordsDiv = document.getElementById("coords");
    // On vide le conteneur coords à chaque nouvelle recherche
    coordsDiv.innerHTML = "";

    // Si l’utilisateur a coché « latitude », on affiche la latitude
    if (infos.includes("latitude")) {
      const pLat = document.createElement("p");
      pLat.innerText = `Latitude : ${lat}`;
      coordsDiv.appendChild(pLat);
    }
    // Si l’utilisateur a coché « longitude », on affiche la longitude
    if (infos.includes("longitude")) {
      const pLon = document.createElement("p");
      pLon.innerText = `Longitude : ${lon}`;
      coordsDiv.appendChild(pLon);
    }
    // =====================================================================

    // Réinitialiser/masquer la carte si elle existait
    resetMapContainer();

    // Toujours afficher la carte, quel que soit l’état des cases latitude/longitude
    initMap(lat, lon);

    // Enfin, récupérer la météo
    fetchMeteo(lat, lon, infos, nbJours);

  } catch (error) {
    console.error("Erreur lors de la récupération des infos de la commune :", error);
    document.getElementById("commune-name").innerText = "Erreur API Géo.";
    clearMapAndForecast();
  }
});

/**
 * Supprime une éventuelle carte Leaflet existante, puis cache #mapid.
 */
function resetMapContainer() {
  if (window._leafletMap) {
    window._leafletMap.remove();
    window._leafletMap = null;
  }
  const mapDiv = document.getElementById("mapid");
  if (mapDiv) {
    mapDiv.classList.add("hidden");
  }
}

/**
 * Masque la carte et vide le conteneur des prévisions.
 */
function clearMapAndForecast() {
  const mapDiv = document.getElementById("mapid");
  if (mapDiv) {
    mapDiv.classList.add("hidden");
  }
  document.getElementById("forecast-container").innerHTML = "";
}

/**
 * Initialise la carte Leaflet centrée sur [lat, lon] et appelle invalidateSize()
 * pour s'assurer que les tuiles s'affichent bien, même si #mapid venait d'être rendu visible.
 */
function initMap(lat, lon) {
  const mapDiv = document.getElementById("mapid");
  if (!mapDiv) return;

  // Rendre visible la div #mapid
  mapDiv.classList.remove("hidden");

  // Supprimer une ancienne instance de carte, si elle existe
  if (window._leafletMap) {
    window._leafletMap.remove();
  }

  // Créer la nouvelle carte Leaflet
  const map = L.map("mapid").setView([lat, lon], 12);
  window._leafletMap = map;

  // Ajouter le tile layer OpenStreetMap
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);

  // Placer un marqueur avec popup (nom de la commune + code postal)
  L.marker([lat, lon]).addTo(map)
    .bindPopup(`${document.getElementById("commune-name").innerText}`)
    .openPopup();

  // Forcer Leaflet à recalculer la taille du conteneur (évite l'affichage “gris”)
  map.invalidateSize();
}

document.addEventListener("DOMContentLoaded", () => {
  const geoBtn = document.getElementById("geo-btn");
  geoBtn.addEventListener("click", () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        position => {
          const lat = position.coords.latitude.toFixed(4);
          const lon = position.coords.longitude.toFixed(4);
          document.querySelector('input[value="latitude"]').checked = true;
          document.querySelector('input[value="longitude"]').checked = true;
          document.getElementById("ville").value = "Ma position";
          document.getElementById("commune-name").innerText = "Géolocalisation activée";

          // On vide l’éventuel conteneur coords de la recherche précédente
          document.getElementById("coords").innerHTML = "";

          resetMapContainer();
          initMap(lat, lon);

          // Reprendre la liste des cases cochées (latitude / longitude / pluie / vent / direction)
          const infos = Array.from(document.querySelectorAll('input[name="infos"]:checked')).map(cb => cb.value);
          fetchMeteo(lat, lon, infos, parseInt(document.getElementById("jours").value, 10));
        },
        error => {
          alert("Impossible d’obtenir la position : " + error.message);
        }
      );
    } else {
      alert("La géolocalisation n’est pas supportée par votre navigateur.");
    }
  });
});