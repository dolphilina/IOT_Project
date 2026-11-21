(function () {
  'use strict';

  var GH = (window.GH = window.GH || {});

  function getPlantSVG(status, healthScore) {
    var st = status || 'unknown';

    // Shared pot base
    var potMarkup =
      '<ellipse cx="70" cy="122" rx="34" ry="5.5" fill="rgba(0,0,0,0.28)"/>' +
      '<path d="M44 92 L96 92 L89 121 C88 123 85 124 82 124 L58 124 C55 124 52 123 51 121 Z" fill="url(#potGrad)" stroke="#9a4b2a" stroke-width="1.5"/>' +
      '<rect x="40" y="86" width="60" height="8" rx="3" fill="#c96b41" stroke="#9a4b2a" stroke-width="1.5"/>' +
      '<ellipse cx="70" cy="86" rx="26" ry="3.2" fill="' +
      (st === 'critical' ? '#5c4635' : '#3a2b20') +
      '"/>';

    var defs =
      '<defs>' +
      '<linearGradient id="potGrad" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0%" stop-color="#d2764c"/>' +
      '<stop offset="100%" stop-color="#8c4223"/>' +
      '</linearGradient>' +
      '<linearGradient id="leafHealthy" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#34d399"/>' +
      '<stop offset="100%" stop-color="#059669"/>' +
      '</linearGradient>' +
      '<linearGradient id="leafAttention" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#a3e635"/>' +
      '<stop offset="100%" stop-color="#ca8a04"/>' +
      '</linearGradient>' +
      '<linearGradient id="leafSick" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#eab308"/>' +
      '<stop offset="100%" stop-color="#a16207"/>' +
      '</linearGradient>' +
      '<linearGradient id="leafCritical" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#b45309"/>' +
      '<stop offset="100%" stop-color="#78350f"/>' +
      '</linearGradient>' +
      '</defs>';

    if (st === 'healthy') {
      return (
        '<svg class="plant-svg plant-svg--healthy" viewBox="0 0 140 132" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
        defs +
        '<circle cx="70" cy="52" r="38" fill="rgba(16,185,129,0.12)"/>' +
        potMarkup +
        '<path d="M70 86 C70 68 69 52 70 28" stroke="#10b981" stroke-width="4" stroke-linecap="round" fill="none"/>' +
        '<path d="M70 72 C56 66 44 60 36 48 C48 44 62 50 70 64 Z" fill="url(#leafHealthy)" stroke="#047857" stroke-width="1.2"/>' +
        '<path d="M70 72 C84 66 96 60 104 48 C92 44 78 50 70 64 Z" fill="url(#leafHealthy)" stroke="#047857" stroke-width="1.2"/>' +
        '<path d="M70 55 C54 45 46 34 44 22 C58 24 66 36 70 49 Z" fill="#34d399" stroke="#047857" stroke-width="1.2"/>' +
        '<path d="M70 55 C86 45 94 34 96 22 C82 24 74 36 70 49 Z" fill="#34d399" stroke="#047857" stroke-width="1.2"/>' +
        '<path d="M70 38 C64 26 65 16 70 10 C75 16 76 26 70 38 Z" fill="#6ee7b7" stroke="#059669" stroke-width="1.2"/>' +
        '<circle cx="52" cy="36" r="3.2" fill="#fde047"/>' +
        '<circle cx="88" cy="34" r="3.2" fill="#fde047"/>' +
        '<circle cx="70" cy="18" r="2.6" fill="#fef08a"/>' +
        '</svg>'
      );
    }

    if (st === 'attention') {
      return (
        '<svg class="plant-svg plant-svg--attention" viewBox="0 0 140 132" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
        defs +
        '<circle cx="70" cy="54" r="36" fill="rgba(245,158,11,0.1)"/>' +
        potMarkup +
        '<path d="M70 86 C70 68 72 52 75 34" stroke="#65a30d" stroke-width="3.8" stroke-linecap="round" fill="none"/>' +
        '<path d="M70 74 C54 72 42 72 34 64 C44 56 58 58 70 68 Z" fill="url(#leafAttention)" stroke="#854d0e" stroke-width="1.2"/>' +
        '<path d="M71 70 C86 68 98 70 106 62 C96 54 82 56 71 64 Z" fill="url(#leafHealthy)" stroke="#15803d" stroke-width="1.2"/>' +
        '<path d="M72 54 C56 48 48 40 44 30 C58 30 66 38 72 49 Z" fill="url(#leafHealthy)" stroke="#15803d" stroke-width="1.2"/>' +
        '<path d="M73 52 C88 46 96 42 102 32 C88 30 79 38 73 48 Z" fill="url(#leafAttention)" stroke="#854d0e" stroke-width="1.2"/>' +
        '<path d="M75 38 C71 28 73 20 79 16 C82 23 80 31 75 38 Z" fill="#bef264" stroke="#65a30d" stroke-width="1.2"/>' +
        '<circle cx="38" cy="64" r="2.2" fill="#facc15"/>' +
        '<circle cx="99" cy="34" r="2.2" fill="#facc15"/>' +
        '</svg>'
      );
    }

    if (st === 'sick') {
      return (
        '<svg class="plant-svg plant-svg--sick" viewBox="0 0 140 132" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
        defs +
        '<circle cx="70" cy="58" r="35" fill="rgba(249,115,22,0.12)"/>' +
        potMarkup +
        '<path d="M70 86 C68 68 62 56 54 44" stroke="#a16207" stroke-width="3.5" stroke-linecap="round" fill="none"/>' +
        '<path d="M68 74 C52 78 40 84 32 78 C40 68 54 66 68 70 Z" fill="url(#leafSick)" stroke="#713f12" stroke-width="1.2"/>' +
        '<path d="M69 72 C84 76 96 84 104 78 C96 68 82 66 69 70 Z" fill="url(#leafSick)" stroke="#713f12" stroke-width="1.2"/>' +
        '<path d="M62 58 C46 58 38 64 34 54 C44 46 54 48 62 54 Z" fill="url(#leafSick)" stroke="#713f12" stroke-width="1.2"/>' +
        '<path d="M63 56 C78 52 88 58 94 50 C84 42 74 44 63 52 Z" fill="#d97706" stroke="#713f12" stroke-width="1.2"/>' +
        '<circle cx="44" cy="75" r="2.4" fill="#78350f"/>' +
        '<circle cx="85" cy="74" r="2.1" fill="#78350f"/>' +
        '<circle cx="46" cy="54" r="2" fill="#78350f"/>' +
        '</svg>'
      );
    }

    if (st === 'critical') {
      return (
        '<svg class="plant-svg plant-svg--critical" viewBox="0 0 140 132" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
        defs +
        '<circle cx="70" cy="60" r="35" fill="rgba(244,63,94,0.14)"/>' +
        potMarkup +
        '<path d="M62 86 L68 84 L74 87" stroke="#292524" stroke-width="1.2" fill="none"/>' +
        '<path d="M70 86 C66 72 56 68 46 66" stroke="#78350f" stroke-width="3.2" stroke-linecap="round" fill="none"/>' +
        '<path d="M67 76 C54 84 44 90 36 86 C42 78 52 74 67 74 Z" fill="url(#leafCritical)" stroke="#451a03" stroke-width="1.2"/>' +
        '<path d="M69 76 C84 82 94 88 100 84 C94 76 82 72 69 74 Z" fill="url(#leafCritical)" stroke="#451a03" stroke-width="1.2"/>' +
        '<path d="M56 68 C44 72 38 76 34 68 C42 62 50 62 56 66 Z" fill="#92400e" stroke="#451a03" stroke-width="1.2"/>' +
        '<path d="M98 118 C105 114 112 117 115 121 C108 124 102 122 98 118 Z" fill="#78350f" stroke="#451a03" stroke-width="1"/>' +
        '<circle cx="96" cy="44" r="9" fill="rgba(244,63,94,0.2)" stroke="#f43f5e" stroke-width="1.5"/>' +
        '<path d="M96 39 L96 45 M96 48 L96 49.2" stroke="#f43f5e" stroke-width="2" stroke-linecap="round"/>' +
        '</svg>'
      );
    }

    // Unknown / no scan yet
    return (
      '<svg class="plant-svg plant-svg--unknown" viewBox="0 0 140 132" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      defs +
      potMarkup +
      '<path d="M70 86 C70 70 70 54 70 38" stroke="#64748b" stroke-width="3" stroke-dasharray="4 3" stroke-linecap="round" fill="none"/>' +
      '<path d="M70 68 C55 62 46 56 42 46 C54 44 64 50 70 62 Z" fill="rgba(148,163,184,0.2)" stroke="#64748b" stroke-width="1.4" stroke-dasharray="4 3"/>' +
      '<path d="M70 68 C85 62 94 56 98 46 C86 44 76 50 70 62 Z" fill="rgba(148,163,184,0.2)" stroke="#64748b" stroke-width="1.4" stroke-dasharray="4 3"/>' +
      '<circle cx="70" cy="30" r="10" fill="rgba(148,163,184,0.18)" stroke="#64748b" stroke-width="1.4"/>' +
      '<text x="70" y="34" text-anchor="middle" fill="#94a3b8" font-size="12" font-weight="700" font-family="monospace">?</text>' +
      '</svg>'
    );
  }

  function getActuatorSVG(key) {
    switch (key) {
      case 'pump':
        return (
          '<svg class="act-svg act-svg--pump" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">' +
          '<path class="drop drop-1" d="M24 8 C24 8 34 20 34 28 C34 33.5 29.5 38 24 38 C18.5 38 14 33.5 14 28 C14 20 24 8 24 8 Z" stroke="currentColor" stroke-width="2.4" fill="currentColor" fill-opacity="0.16"/>' +
          '<path d="M20 28 C20 30.5 21.8 32.5 24 33" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
          '</svg>'
        );
      case 'heater':
        return (
          '<svg class="act-svg act-svg--heater" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">' +
          '<path class="wave wave-1" d="M15 34 C12 29 18 24 15 19 C13 15 15 12 16 10" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>' +
          '<path class="wave wave-2" d="M24 34 C21 29 27 24 24 19 C22 15 24 12 25 10" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>' +
          '<path class="wave wave-3" d="M33 34 C30 29 36 24 33 19 C31 15 33 12 34 10" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>' +
          '<rect x="10" y="37" width="28" height="4" rx="2" fill="currentColor" fill-opacity="0.7"/>' +
          '</svg>'
        );
      case 'humidifier':
        return (
          '<svg class="act-svg act-svg--humidifier" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">' +
          '<path d="M12 29 H32 C35 29 37 26.8 37 24 C37 21.4 35 19.3 32.4 19.1 C31.4 14.5 27.2 11 22.3 11 C16.6 11 12 15.6 12 21.3 C9.2 21.8 7 24.2 7 27 C7 28.2 9.2 29 12 29 Z" stroke="currentColor" stroke-width="2.2" fill="currentColor" fill-opacity="0.14"/>' +
          '<circle class="mist m1" cx="15" cy="36" r="2" fill="currentColor"/>' +
          '<circle class="mist m2" cx="24" cy="38" r="2.2" fill="currentColor"/>' +
          '<circle class="mist m3" cx="33" cy="35" r="2" fill="currentColor"/>' +
          '</svg>'
        );
      case 'light':
        return (
          '<svg class="act-svg act-svg--light" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">' +
          '<circle cx="24" cy="24" r="8" stroke="currentColor" stroke-width="2.4" fill="currentColor" fill-opacity="0.2"/>' +
          '<g class="rays">' +
          '<path d="M24 7 V11 M24 37 V41 M7 24 H11 M37 24 H41 M12 12 L15 15 M33 33 L36 36 M36 12 L33 15 M15 33 L12 36" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>' +
          '</g>' +
          '</svg>'
        );
      case 'fan':
      default:
        return (
          '<svg class="act-svg act-svg--fan" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">' +
          '<circle cx="24" cy="24" r="17" stroke="currentColor" stroke-width="1.8" stroke-opacity="0.35"/>' +
          '<g class="fan-blades">' +
          '<path d="M24 24 C21 15 24 9 29 11 C33 12 31 19 24 24 Z" fill="currentColor" fill-opacity="0.85"/>' +
          '<path d="M24 24 C33 21 39 24 37 29 C36 33 29 31 24 24 Z" fill="currentColor" fill-opacity="0.85"/>' +
          '<path d="M24 24 C27 33 24 39 19 37 C15 36 17 29 24 24 Z" fill="currentColor" fill-opacity="0.85"/>' +
          '<path d="M24 24 C15 27 9 24 11 19 C12 15 19 17 24 24 Z" fill="currentColor" fill-opacity="0.85"/>' +
          '<circle cx="24" cy="24" r="3.2" fill="var(--bg-card)" stroke="currentColor" stroke-width="2"/>' +
          '</g>' +
          '</svg>'
        );
    }
  }

  GH.SVG = {
    getPlantSVG: getPlantSVG,
    getActuatorSVG: getActuatorSVG
  };
})();
