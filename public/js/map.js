(function () {
  "use strict";

  /* ── Guard: only run on show page ── */
  if (!document.getElementById("listingMap")) return;

  /* ── Server data (set by window.LOCARA_LISTING in show.ejs) ── */
  const LISTING = window.LOCARA_LISTING || {};
  const LAT   = parseFloat(LISTING.lat)  || 28.6139;
  const LNG   = parseFloat(LISTING.lng)  || 77.2090;
  const TITLE = LISTING.title            || "Listing";
  const PRICE = Number(LISTING.price)    || 0;
  const LOC   = LISTING.location         || "";

  /* ── Init Leaflet map ── */
  function initMap() {
    if (typeof L === "undefined") return setTimeout(initMap, 200);

    const mapEl = document.getElementById("listingMap");
    if (!mapEl) return;

    const map = L.map(mapEl, {
      center:             [LAT, LNG],
      zoom:               13,
      zoomControl:        false,
      scrollWheelZoom:    false,
      attributionControl: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);

    /* Price bubble marker */
    const bubbleIcon = L.divIcon({
      className:  "",
      html:       `<div class="locara-map-bubble">&#8377;${PRICE.toLocaleString("en-IN")}</div>`,
      iconAnchor: [40, 18],
      iconSize:   [80, 36],
    });

    const marker = L.marker([LAT, LNG], { icon: bubbleIcon }).addTo(map);
    marker.bindPopup(
      `<div class="locara-map-popup"><strong>${TITLE}</strong><span>${LOC}</span></div>`,
      { closeButton: false, offset: [0, -10] }
    );

    L.control.attribution({ prefix: false })
      .addAttribution('&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>')
      .addTo(map);

    L.control.zoom({ position: "bottomright" }).addTo(map);

    /* Recalculate size after layout paint */
    setTimeout(() => map.invalidateSize(), 400);
  }

  initMap();

})();
// Map resize and orientation change stabilizer
(function () {
  if (typeof L === 'undefined' || !window.LOCARA_LISTING) return;

  let resizeTimeout;
  window.addEventListener('resize', () => {
    // Debounce resize events to protect main thread during rotations
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      if (window.map && typeof window.map.invalidateSize === 'function') {
        window.map.invalidateSize({ animate: true });
        
        // Auto-recenter the marker so it remains in dead center of the viewport
        const lat = window.LOCARA_LISTING.lat;
        const lng = window.LOCARA_LISTING.lng;
        window.map.panTo([lat, lng]);
      }
    }, 250); // wait for rotation animation to complete
  });
})();