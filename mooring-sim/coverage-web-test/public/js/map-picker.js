/**
 * Leaflet minimap with rectangle drawing for bbox selection.
 * Uses leaflet-draw for interactive rectangle.
 */

export class MapPicker {
  constructor(containerId, onChange) {
    this.onChange = onChange;
    this.bbox = null;
    this.rect = null;

    // Moorea, French Polynesia (default view matching config.yaml)
    this.map = L.map(containerId, {
      center: [-17.52, -149.83],
      zoom: 11,
      zoomControl: true,
    });

    // Satellite tiles (ESRI)
    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        attribution: "Esri Satellite",
        maxZoom: 19,
      }
    ).addTo(this.map);

    // Draw control for rectangles
    this.drawnItems = new L.FeatureGroup();
    this.map.addLayer(this.drawnItems);

    const drawControl = new L.Control.Draw({
      draw: {
        rectangle: {
          shapeOptions: {
            color: "#0ea5e9",
            weight: 2,
            fillOpacity: 0.15,
          },
        },
        polygon: false,
        polyline: false,
        circle: false,
        marker: false,
        circlemarker: false,
      },
      edit: {
        featureGroup: this.drawnItems,
      },
    });
    this.map.addControl(drawControl);

    // Handle draw events
    this.map.on(L.Draw.Event.CREATED, (e) => {
      this.drawnItems.clearLayers();
      this.rect = e.layer;
      this.drawnItems.addLayer(this.rect);
      this._updateBbox();
    });

    this.map.on(L.Draw.Event.EDITED, () => {
      this._updateBbox();
    });

    this.map.on(L.Draw.Event.DELETED, () => {
      this.bbox = null;
      this.rect = null;
      this.onChange(null);
    });

    // Load default bbox from config (North Moorea)
    this._setDefaultBbox();
  }

  _setDefaultBbox() {
    const bounds = [
      [-17.555, -149.87],
      [-17.485, -149.80],
    ];
    this.rect = L.rectangle(bounds, {
      color: "#0ea5e9",
      weight: 2,
      fillOpacity: 0.15,
    });
    this.drawnItems.addLayer(this.rect);
    this._updateBbox();
    this.map.fitBounds(bounds, { padding: [20, 20] });
  }

  _updateBbox() {
    if (!this.rect) return;
    const b = this.rect.getBounds();
    this.bbox = [
      b.getWest(),
      b.getSouth(),
      b.getEast(),
      b.getNorth(),
    ];
    this.onChange(this.bbox);
  }

  getBbox() {
    return this.bbox;
  }
}
