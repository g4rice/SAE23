// recupinfometeo.js

let currentUnit = "C";
let tempChart = null;
window.lastLat = null;
window.lastLon = null;
window.lastNbJours = null;

/**
 * Récupère les prévisions météo depuis l'API Météo-Concept et affiche les cartes,
 * en gérant proprement les erreurs (HTTP 403, JSON inattendu, etc.).
 *
 * @param {string} lat       - latitude (ex. "48.8566")
 * @param {string} lon       - longitude (ex. "2.3522")
 * @param {Array<string>} infos - cases cochées (["latitude","pluie","vent","direction"] )
 * @param {number} nbJours      - nombre de jours souhaité (1 à 7)
 */
async function fetchMeteo(lat, lon, infos, nbJours) {
  // S’assurer que nbJours est un entier entre 1 et 7
  nbJours = parseInt(nbJours, 10);
  if (!nbJours || nbJours < 1 || nbJours > 7) nbJours = 1;

  // Conserver ces valeurs pour le toggle °C/°F
  window.lastLat = lat;
  window.lastLon = lon;
  window.lastNbJours = nbJours;

  // Afficher le loader
  document.getElementById("loader").classList.remove("hidden");

  // Remplacez par votre propre token valide
  const token = "87a1a742543d8b724a785e8adaf301ae55e2b30931364629dd660d785001e0b7";

  try {
    // 1) Envoyer la requête
    const response = await fetch(
      `https://api.meteo-concept.com/api/forecast/daily?token=${token}&latlng=${lat},${lon}&limit=${nbJours}`,
      { headers: { "Accept": "application/json" } }
    );

    // 2) Si statut HTTP != 200–299, afficher un message d’erreur et quitter
    if (!response.ok) {
      console.error(`Erreur HTTP ${response.status} lors de l'appel à l'API Météo-Concept`);
      let errMsg = `Erreur ${response.status} : impossible de récupérer les prévisions.`;
      if (response.status === 403) {
        errMsg = "Accès refusé (403) : token invalide ou quota dépassé.";
      }
      document.getElementById("forecast-container").innerHTML =
        `<p class="error">${errMsg}</p>`;
      document.getElementById("loader").classList.add("hidden");
      return;
    }

    // 3) Parser le JSON
    const data = await response.json();

    // 4) Vérifier que data.forecast existe et est un tableau
    if (!data.forecast || !Array.isArray(data.forecast)) {
      console.error("Structure JSON inattendue : data.forecast absent ou non‐tableau", data);
      document.getElementById("forecast-container").innerHTML =
        "<p class=\"error\">Données météo manquantes ou structure inattendue.</p>";
      document.getElementById("loader").classList.add("hidden");
      return;
    }

    // 5) Afficher les cartes météo
    createForecastCards(data.forecast.slice(0, nbJours), infos);

    // 6) Masquer le loader
    document.getElementById("loader").classList.add("hidden");

    // 7) Dessiner le graphique des températures (affiche la section #chart-section)
    drawTemperatureChart(data.forecast.slice(0, nbJours));

  } catch (error) {
    // Exception réseau ou JSON mal formé
    console.error("Exception lors de l'appel à l'API Météo :", error);
    document.getElementById("forecast-container").innerHTML =
      "<p class=\"error\">Une erreur est survenue lors de la récupération des prévisions.</p>";
    document.getElementById("loader").classList.add("hidden");
  }
}

/**
 * Crée et injecte les cartes météo dans #forecast-container.
 *
 * @param {Array<Object>} forecastArray - tableau d'objets forecast (datetime, weather, tmin, tmax, rr10, wind10m, dirwind10m)
 * @param {Array<string>} infos         - cases cochées pour afficher pluie/vent/direction
 */
function createForecastCards(forecastArray, infos) {
  const container = document.getElementById("forecast-container");
  container.innerHTML = ""; // Vider l’ancien contenu

  forecastArray.forEach((jour, index) => {
    // Formater la date (ex. "samedi 31 mai")
    const dateObj = new Date(jour.datetime);
    const optionsDate = { weekday: "long", day: "numeric", month: "long" };
    const jourFormate = dateObj.toLocaleDateString("fr-FR", optionsDate);

    // Récupérer l’URL de l’icône locale
    const iconUrl = getWeatherIcon(jour.weather);

    // Construire la carte
    const card = document.createElement("div");
    card.classList.add("forecast-card");

    // Titre : "Jour X – date"
    const h3 = document.createElement("h3");
    h3.innerText = `Jour ${index + 1} – ${jourFormate}`;
    card.appendChild(h3);

    // Icône météo
    const img = document.createElement("img");
    img.src = iconUrl;
    img.alt = getWeatherDescription(jour.weather);
    img.width = 50;
    img.height = 50;
    card.appendChild(img);

    // Température min (affichée en gros)
    const tempVal = document.createElement("p");
    tempVal.classList.add("temp-value");
    tempVal.innerText = `${convertTemp(jour.tmin)}°${currentUnit}`;
    card.appendChild(tempVal);

    // Description (ex. "Ensoleillé", "Nuageux", etc.)
    const desc = document.createElement("p");
    desc.classList.add("description");
    desc.innerText = getWeatherDescription(jour.weather);
    card.appendChild(desc);

    // Min / Max
    const minmax = document.createElement("p");
    minmax.classList.add("minmax");
    minmax.innerText =
      `Min : ${convertTemp(jour.tmin)}°${currentUnit} – Max : ${convertTemp(jour.tmax)}°${currentUnit}`;
    card.appendChild(minmax);

    // Infos supplémentaires selon cases cochées
    if (infos.includes("pluie")) {
      const pPluie = document.createElement("div");
      pPluie.classList.add("extra-info");
      pPluie.innerHTML =
        `<span class="extra-label">Pluie :</span> <span class="extra-value">${jour.rr10} mm</span>`;
      card.appendChild(pPluie);
    }
    if (infos.includes("vent")) {
      const pVent = document.createElement("div");
      pVent.classList.add("extra-info");
      pVent.innerHTML =
        `<span class="extra-label">Vent :</span> <span class="extra-value">${jour.wind10m} km/h</span>`;
      card.appendChild(pVent);
    }
    if (infos.includes("direction")) {
      const pDir = document.createElement("div");
      pDir.classList.add("extra-info");
      pDir.innerHTML =
        `<span class="extra-label">Direction :</span> <span class="extra-value">${jour.dirwind10m} °</span>`;
      card.appendChild(pDir);
    }

    container.appendChild(card);
  });
}

/**
 * Renvoie le chemin local vers l’icône météo correspondant au code numérique.
 */
function getWeatherIcon(code) {
  const c = parseInt(code, 10);
  if (c === 0 || c === 1 || c === 2) {
    return "img/soleil.png";
  }
  if (c === 3 || c === 4 || c === 5) {
    return "img/nuage.png";
  }
  if (c === 6 || c === 7 || c === 8) {
    return "img/brouillard.png";
  }
  if ([10, 11, 12, 13, 14, 40, 41, 42].includes(c)) {
    return "img/nuage_pluie.png";
  }
  if ([20, 21, 22, 23, 24, 45, 46, 47].includes(c)) {
    return "img/orage.png";
  }
  if ([30, 31, 32, 33, 34, 35, 36, 37, 50, 51, 52].includes(c)) {
    return "img/neige.png";
  }
  return "img/nuage.png";
}

/**
 * Fournit une description textuelle pour l’attribut alt de l’icône.
 */
function getWeatherDescription(code) {
  const c = parseInt(code, 10);
  if (c === 0 || c === 1 || c === 2) return "Ensoleillé";
  if (c === 3 || c === 4 || c === 5) return "Nuageux";
  if (c === 6 || c === 7 || c === 8) return "Brouillard";
  if ([10, 11, 12, 13, 14, 40, 41, 42].includes(c)) return "Pluie";
  if ([20, 21, 22, 23, 24, 45, 46, 47].includes(c)) return "Orage";
  if ([30, 31, 32, 33, 34, 35, 36, 37, 50, 51, 52].includes(c)) return "Neige";
  return "Variable";
}

/**
 * Convertit une température Celsius en Celsius ou Fahrenheit selon currentUnit.
 */
function convertTemp(tempC) {
  if (currentUnit === "C") {
    return tempC;
  } else {
    return ((tempC * 9) / 5 + 32).toFixed(1);
  }
}

/**
 * Dessine un graphique Chart.js avec températures min et max.
 *   - Avant de dessiner le graphique, on affiche la section #chart-section
 *   - Si tempChart existe déjà, on le détruit d’abord.
 */
function drawTemperatureChart(forecastArray) {
  // 1) afficher la section graphique
  const chartSect = document.getElementById("chart-section");
  if (chartSect) {
    chartSect.style.display = "flex";
  }

  // 2) récupérer le context du canvas
  const ctx = document.getElementById("tempChart")?.getContext("2d");
  if (!ctx) return;

  const labels = forecastArray.map((_, i) => `Jour ${i + 1}`);
  const dataMin = forecastArray.map(j => convertTemp(j.tmin));
  const dataMax = forecastArray.map(j => convertTemp(j.tmax));

  // 3) détruire l’ancien graphique s’il existe
  if (tempChart) {
    tempChart.destroy();
  }

  // 4) créer le nouveau graphique
  tempChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: `Temp max (°${currentUnit})`,
          data: dataMax,
          borderColor: "rgba(255,99,132,1)",
          backgroundColor: "rgba(255,99,132,0.2)",
          fill: false,
          tension: 0.2,
          borderWidth: 2,
          pointRadius: 4
        },
        {
          label: `Temp min (°${currentUnit})`,
          data: dataMin,
          borderColor: "rgba(54,162,235,1)",
          backgroundColor: "rgba(54,162,235,0.2)",
          fill: false,
          tension: 0.2,
          borderWidth: 2,
          pointRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: false,
          grid: { color: "#e0e0e0" },
          ticks: { color: "#333333" }
        },
        x: {
          grid: { color: "#e0e0e0" },
          ticks: { color: "#333333" }
        }
      },
      plugins: {
        legend: {
          labels: {
            color: "#333333",
            boxWidth: 20,
            boxHeight: 3
          }
        }
      }
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  // Toggle °C / °F – (redondant avec index.html, mais on le garde)
  const btnToggle = document.getElementById("toggle-units");
  if (btnToggle) {
    btnToggle.addEventListener("click", () => {
      currentUnit = currentUnit === "C" ? "F" : "C";
      btnToggle.textContent = currentUnit === "C" ? "Passer en °F" : "Passer en °C";
      if (window.lastLat && window.lastLon && window.lastNbJours) {
        const infos = Array.from(document.querySelectorAll('input[name="infos"]:checked')).map(cb => cb.value);
        fetchMeteo(window.lastLat, window.lastLon, infos, window.lastNbJours);
      }
    });
  }
});
