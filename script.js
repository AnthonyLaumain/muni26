// -------------------------------
// Initialisation de la carte AVANT tout
const view = new ol.View({
  center: ol.proj.fromLonLat([3.174880,45.686700]), // Paris par défaut
  zoom: 12
});


////////////////////////////////
// Mise en place des controls //
////////////////////////////////
var cont_zoom = new ol.control.Zoom({
	zoomInTipLabel: 'Zoomer',
	zoomOutTipLabel: 'Dézoomer',
})

var cont_echelle = new ol.control.ScaleLine({})

////////////////////////////////
// Chargement des couches //
////////////////////////////////

// Création d'une couche vector tile
const vectorTileLayer = new ol.layer.VectorTile({
  source: new ol.source.VectorTile({
    format: new ol.format.MVT(),
    url: 'https://data.geopf.fr/tms/1.0.0/BDTOPO/{z}/{x}/{y}.pbf'
  })
});
// Appliquer le style Mapbox JSON
olms.applyStyle(vectorTileLayer, 'https://data.geopf.fr/annexes/ressources/vectorTiles/styles/PLAN.IGN/gris.json');


const osmGrayLayer = new ol.layer.Tile({
  source: new ol.source.XYZ({
    url: 'https://{1-4}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attributions: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
    maxZoom: 20
  })
});


// Fonction de style
const styleCommune = function(feature_style) {

  // récupérer la valeur du champ
  const nbListes = feature_style.get('nb_liste');

  // calcul du rayon (ajuster le facteur selon ton besoin)
  const radius = 7+ (nbListes * 2);

  return new ol.style.Style({
    image: new ol.style.Circle({
      radius: radius,
      fill: new ol.style.Fill({
        color: '#c5050b'
      }),
      /*stroke: new ol.style.Stroke({
        color: '#333',
        width: 1
      })*/
    }),

    // Texte dans le cercle
    text: new ol.style.Text({
      text: nbListes.toString(),
      font: 'bold 11px Arial',
      fill: new ol.style.Fill({
        color: '#ffffff'
      }),
    })
  });
};


var communes_poly = new ol.layer.Vector
({
	title: 'Communes polygones',
	source:  new ol.source.Vector({
		url: 'https://raw.githubusercontent.com/AnthonyLaumain/muni26/main/DATA/communes_poly.geojson', /*'https://raw.githubusercontent.com/AnthonyLaumain/muni26/refs/heads/main/DATA/communes_poly.geojson',*/
		format: new ol.format.GeoJSON()
	}),
  style: new ol.style.Style({
    fill: new ol.style.Fill({color: 'rgba(0,0,0,0.01)'}),
    stroke: new ol.style.Stroke({ color: 'black', width: 0.4}),
    }),
  visible: true,
})

var epci_poly = new ol.layer.Vector
({
	title: 'EPCI',
	source:  new ol.source.Vector({
		url: 'https://raw.githubusercontent.com/AnthonyLaumain/muni26/main/DATA/epci.geojson', /*https://raw.githubusercontent.com/AnthonyLaumain/muni26/refs/heads/main/DATA/epci.geojson' */ 
		format: new ol.format.GeoJSON()
	}),
  style: new ol.style.Style({
    stroke: new ol.style.Stroke({ color: '#c5050b', width: 2}),
    }),
  visible: true,
})

var communes_pt = new ol.layer.Vector
({
	title: 'Communes points',
	source:  new ol.source.Vector({
		url: 'https://raw.githubusercontent.com/AnthonyLaumain/muni26/main/DATA/communes_pt.geojson', /*'https://raw.githubusercontent.com/AnthonyLaumain/muni26/refs/heads/main/DATA/communes_pt.geojson' */
		format: new ol.format.GeoJSON()
	}),
  visible: true,
  style: styleCommune,
})


////////////////////////////////
// Liste des communes dans le bouton //
////////////////////////////////

// Sélection du select et du panneau d'infos
const select = document.getElementById('selectCommune');
const infoDiv = document.getElementById('commune-info');

// Une fois que la source vectorielle est prête
communes_poly.getSource().once('change', function() {
  if (communes_poly.getSource().getState() === 'ready') {

    // Récupérer toutes les features
    let features = communes_poly.getSource().getFeatures();

    // Créer un tableau {name, feature} pour trier
    let communes = features.map(f => ({
      name: f.get('nom_officiel_en_majuscules'),
      feature: f
    }));

    // Trier par ordre alphabétique
    communes.sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));

    // Remplir le select
    communes.forEach(c => {
      const option = document.createElement('option');
      option.value = c.feature.getId() || c.name;
      option.textContent = c.name;
      select.appendChild(option);
    });
  }
});


select.addEventListener('change', function() {
  const val = this.value;
  if (!val) return;

  // retrouver la feature correspondante
  let feature = null;
  communes_poly.getSource().getFeatures().forEach(f => {
    if ((f.getId() && f.getId() === val) || f.get('nom_officiel_en_majuscules') === val) {
      feature = f;
    }
  });

  if (feature) {

    // appliquer le style de surbrillance
    feature.setStyle(hoverStyle);
    highlightedFeature = feature;

    // zoomer sur la commune
    const geometry = feature.getGeometry();
    const extent = geometry.getExtent();
    map.getView().fit(extent, { duration: 700, padding: [50, 50, 50, 50], maxZoom: 14 });

    const infoDiv = document.getElementById('commune-info');
    const nbListes = feature.get('nb_liste');

    // vérifier si nb_liste est null ou 0
    if (!nbListes) {
      infoDiv.innerHTML = `<p><b>Aucune liste pour la commune</b></p>`;
      popupContent.innerHTML = infoDiv.innerHTML;
      popup.setPosition(ol.extent.getCenter(extent));
      return; // on sort ici
    }

    // sinon, générer les listes normalement
    const noms = feature.get('nom').split(';');
    const listes = feature.get('Libellé de la liste').split(';');
    const nuances = feature.get('Nuance de liste').split(';');

    let htmlList = '';
    for (let i = 0; i < noms.length; i++) {
      htmlList += `<li>${noms[i].trim()} - ${listes[i].trim()} (${nuances[i].trim()})</li>`;
    }

    infoDiv.innerHTML = `
      <b>Nombre de listes :</b> ${nbListes}<br><br>
      <b>Liste(s) inscrites dans la commune :</b>
      <ul>${htmlList}</ul>
    `;
  }
});

const hoverStyle = new ol.style.Style({
  stroke: new ol.style.Stroke({
    color: '#d00000',   // rouge vif
    width: 3
  }),
  fill: new ol.style.Fill({
    color: 'rgba(208,0,0,0.2)' // rouge semi-transparent
  })
});
let hoveredFeature = null;


///////////////////////////
// Affichage de la carte //
///////////////////////////
var map = new ol.Map({
	target: 'map',
	layers: [osmGrayLayer,communes_poly , epci_poly, communes_pt],
	controls:[
		cont_zoom,
		cont_echelle,
  ],
	view: view
});
map.on('pointermove', function(evt) {

  // réinitialiser l’ancienne feature
  if (hoveredFeature) {
    hoveredFeature.setStyle(undefined);
    hoveredFeature = null;
  }

  // récupère la feature sous le curseur **uniquement sur communes_poly**
  const feature = map.forEachFeatureAtPixel(evt.pixel, function(feature, layer) {
    return feature;
  }, {
    layerFilter: function(layer) {
      return layer === communes_poly; // seulement cette couche
    }
  });

  if (feature) {
    feature.setStyle(hoverStyle);
    hoveredFeature = feature;
  }
});


////////////////////////////////
// Popup //
////////////////////////////////

const popupContainer = document.getElementById('popup');
const popupContent = document.getElementById('popup-content');
const closer = document.getElementById('popup-closer');

closer.onclick = function () {
  popup.setPosition(undefined);
  closer.blur();
  return false;
};


const popup = new ol.Overlay({
  element: popupContainer,
  closeBox: true,
  positioning: 'bottom-center',
  stopEvent: false,
  offset: [0, -10],
  stopEvent: true,   // important

});

map.addOverlay(popup);


map.on('singleclick', function(evt) {

  const feature = map.forEachFeatureAtPixel(evt.pixel, function(feature) {
    return feature;
  });

  if (feature) {

    const commune = feature.get('Circonscription');
    const nbListes = feature.get('nb_liste');

    const coord = evt.coordinate;

    // Si nb_liste est null ou 0, afficher seulement le nom et un message
    if (!nbListes) {
      popupContent.innerHTML =
        '<div class="popup-title">' + commune + '</div>' +
        '<p><b>Aucune liste pour la commune</b></p>';
    } else {
      // Sinon, générer les listes normalement
      const noms = feature.get('nom').split(';');
      const listes = feature.get('Libellé de la liste').split(';');
      const nuances = feature.get('Nuance de liste').split(';');

      let htmlList = '';
      for (let i = 0; i < noms.length; i++) {
        htmlList +=
          '<li>' +
          noms[i].trim() + ' - ' +
          listes[i].trim() +
          ' (' + nuances[i].trim() + ')' +
          '</li>';
      }

      popupContent.innerHTML =
        '<div class="popup-title">' + commune + '</div>' +
        '<b>Nombre de listes :</b> ' + nbListes +
        '<br><br><b>Liste(s) inscrites dans la commune :</b>' +
        '<ul>' + htmlList + '</ul>';
    }

    popup.setPosition(coord);

  } else {
    popup.setPosition(undefined);
  }

});

