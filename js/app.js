(function () {
  'use strict';

  var GH = (window.GH = window.GH || {});
  var CFG = GH.CONFIG;

  var activeTab = 'overview';
  var pendingImage = null; // { img, previewUrl, base64Jpeg, thumbUrl }

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatTime(ts) {
    if (!ts) return 'никогда';
    return new Date(ts).toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  function formatDateTime(ts) {
    if (!ts) return 'Ещё не проверялось';
    return new Date(ts).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function showToast(message, type) {
    var container = $('toast-container');
    if (!container) return;
    var el = document.createElement('div');
    el.className = 'toast' + (type ? ' toast--' + type : '');
    el.textContent = message;
    container.appendChild(el);
    setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 3600);
  }

  /* ================= THEME ================= */
  function applyTheme(theme) {
    var normalized = theme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', normalized);
    var icon = $('theme-icon');
    if (icon) {
      icon.textContent = normalized === 'light' ? '☾' : '☀';
    }
    if (GH.Charts && GH.Charts.applyTheme) {
      GH.Charts.applyTheme();
    }
  }

  /* ================= TABS ================= */
  function switchTab(tabName) {
    activeTab = tabName;
    var btns = document.querySelectorAll('.nav-tab[data-tab]');
    btns.forEach(function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-tab') === tabName);
    });
    var panels = document.querySelectorAll('.tab-panel');
    panels.forEach(function (panel) {
      panel.classList.toggle('is-active', panel.id === 'tab-' + tabName);
    });

    if (tabName === 'charts' && GH.Charts) {
      setTimeout(function () {
        GH.Charts.resizeAll();
      }, 20);
    }
    if (tabName === 'ai') {
      renderAiPlantSelect();
      renderAiTelemetryContext();
      renderAiHistory();
    }
  }

  /* ================= CONNECTION PILL ================= */
  function renderConnection() {
    var conn = GH.State.connection;
    var dot = $('connection-dot');
    var label = $('connection-label');
    var modalStatus = $('cfg-mqtt-status-text');

    if (dot) {
      dot.className = 'conn-dot';
      if (conn.status === 'connected') dot.classList.add('is-connected');
      else if (conn.status === 'connecting') dot.classList.add('is-connecting');
      else if (conn.status === 'error') dot.classList.add('is-error');
    }

    if (label) {
      if (GH.State.settings.source === 'sim') {
        label.textContent = 'Симулятор';
      } else if (conn.status === 'connected') {
        label.textContent = conn.espOnline ? 'ESP32 · Online' : 'MQTT · Ожидание ESP32';
      } else if (conn.status === 'connecting') {
        label.textContent = 'MQTT · Подключение…';
      } else if (conn.status === 'error') {
        label.textContent = 'MQTT · Ошибка';
      } else {
        label.textContent = 'MQTT · Отключён';
      }
    }

    if (modalStatus) {
      modalStatus.textContent = 'Статус: ' + (conn.message || conn.status);
    }
  }

  /* ================= PLANTS BAY (<= 5) ================= */
  function getScoreBarColor(status) {
    switch (status) {
      case 'healthy':
        return '#10b981';
      case 'attention':
        return '#f59e0b';
      case 'sick':
        return '#f97316';
      case 'critical':
        return '#f43f5e';
      default:
        return '#64748b';
    }
  }

  function renderPlants() {
    var plants = GH.State.plants;
    var grid = $('plants-grid');
    var badge = $('plant-count-badge');
    var addBtn = $('btn-add-plant');
    if (!grid) return;

    if (badge) badge.textContent = plants.length + ' / ' + CFG.MAX_PLANTS;
    if (addBtn) {
      addBtn.disabled = plants.length >= CFG.MAX_PLANTS;
      addBtn.title =
        plants.length >= CFG.MAX_PLANTS
          ? 'Достигнут максимум (' + CFG.MAX_PLANTS + ' растений)'
          : 'Добавить новое растение в теплицу';
    }

    var html = plants
      .map(function (plant) {
        var meta = CFG.STATUS_META[plant.status] || CFG.STATUS_META.unknown;
        var hasScore = plant.healthScore !== null && plant.healthScore !== undefined;
        var scoreText = hasScore ? plant.healthScore + '%' : '--%';
        var fillWidth = hasScore ? Math.max(4, Math.min(100, plant.healthScore)) : 0;
        var fillColor = getScoreBarColor(plant.status);

        return (
          '<article class="plant-card" data-plant-id="' + escapeHtml(plant.id) + '">' +
          '  <div class="plant-card-top">' +
          '    <div class="plant-svg-box">' + GH.SVG.getPlantSVG(plant.status, plant.healthScore) + '</div>' +
          '    <div class="plant-meta">' +
          '      <div class="plant-name" title="' + escapeHtml(plant.name) + '">' + escapeHtml(plant.name) + '</div>' +
          '      <div class="plant-species">' + escapeHtml(plant.species || 'Культура не указана') + '</div>' +
          '      <div class="plant-score-row">' +
          '        <span class="status-pill ' + meta.badgeClass + '">' + meta.label + '</span>' +
          '        <span class="plant-score-num">' + scoreText + '</span>' +
          '      </div>' +
          '    </div>' +
          '  </div>' +
          '  <div class="health-bar-track">' +
          '    <div class="health-bar-fill" style="width:' + fillWidth + '%;background:' + fillColor + '"></div>' +
          '  </div>' +
          '  <p class="plant-diag-snippet">' + escapeHtml(plant.lastDiagnosis || 'Ожидает проверки по фото') + '</p>' +
          '  <div class="plant-scan-time">Проверка: ' + escapeHtml(formatDateTime(plant.lastScanAt)) + '</div>' +
          '  <div class="plant-card-actions">' +
          '    <button type="button" class="btn btn-primary btn-xs" data-action="scan-plant" data-id="' + escapeHtml(plant.id) + '">Фото-диагностика</button>' +
          '    <button type="button" class="btn btn-outline btn-xs" data-action="edit-plant" data-id="' + escapeHtml(plant.id) + '">Карточка</button>' +
          '  </div>' +
          '</article>'
        );
      })
      .join('');

    if (plants.length < CFG.MAX_PLANTS) {
      html +=
        '<button type="button" class="plant-empty-slot" id="btn-empty-add-plant">' +
        '  <span style="font-size:1.5rem;font-weight:700">+</span>' +
        '  <span>Свободное место (' + (plants.length + 1) + ' из ' + CFG.MAX_PLANTS + ')</span>' +
        '</button>';
    }

    grid.innerHTML = html;
  }

  /* ================= SENSORS & OLED ================= */
  function buildSensorsGrid() {
    var grid = $('sensors-grid');
    if (!grid) return;

    grid.innerHTML = CFG.SENSORS.map(function (s) {
      var wideClass = s.key === 'lightLevel' ? ' sensor-card--wide' : '';
      var extraBtn =
        s.key === 'waterLevel'
          ? '<button type="button" class="btn btn-outline btn-xs" id="btn-refill-tank">Пополнить 100%</button>'
          : '';

      return (
        '<div class="sensor-card' + wideClass + '" id="sensor-card-' + s.key + '">' +
        '  <div class="sensor-top">' +
        '    <span class="sensor-label">' + escapeHtml(s.label) + '</span>' +
        '    <span class="sensor-gpio">' + escapeHtml(s.hardware + ' · ' + s.gpio) + '</span>' +
        '  </div>' +
        '  <div class="sensor-value-row">' +
        '    <div>' +
        '      <span class="sensor-val" id="sval-' + s.key + '">--</span>' +
        '      <span class="sensor-unit">' + escapeHtml(s.unit) + '</span>' +
        '    </div>' +
        '    <div style="display:flex;align-items:center;gap:6px">' +
               extraBtn +
        '      <span class="sensor-trend" id="strend-' + s.key + '">→</span>' +
        '    </div>' +
        '  </div>' +
        '  <div class="sensor-bar-track">' +
        '    <div class="sensor-optimal-band" id="sband-' + s.key + '"></div>' +
        '    <div class="sensor-bar-fill" id="sbar-' + s.key + '" style="width:0%;background:' + s.color + '"></div>' +
        '  </div>' +
        '  <div class="sensor-foot">' +
        '    <span class="sensor-status-badge" id="sstatus-' + s.key + '">' +
        '      <span class="sensor-status-dot" id="sdot-' + s.key + '"></span>' +
        '      <span id="sstext-' + s.key + '">Норма</span>' +
        '    </span>' +
        '    <span id="srange-' + s.key + '">--</span>' +
        '  </div>' +
        '</div>'
      );
    }).join('');
  }

  function evaluateSensorStatus(sensor, value, th) {
    var optMin = th[sensor.thresholdMinKey];
    var optMax = sensor.thresholdMaxKey ? th[sensor.thresholdMaxKey] : sensor.max;

    if (sensor.key === 'waterLevel') {
      if (value <= optMin) return { text: 'Критично низкий', color: '#f43f5e' };
      if (value <= optMin + 12) return { text: 'Пополнить бак', color: '#f59e0b' };
      return { text: 'Норма', color: '#10b981' };
    }
    if (sensor.key === 'lightLevel') {
      if (value < optMin) return { text: 'Мало света', color: '#f59e0b' };
      return { text: 'Норма', color: '#10b981' };
    }

    if (value < optMin - 4 || value > optMax + 4) {
      return { text: 'Критично', color: '#f43f5e' };
    }
    if (value < optMin || value > optMax) {
      return { text: 'Отклонение', color: '#f59e0b' };
    }
    return { text: 'Норма', color: '#10b981' };
  }

  function renderTelemetry() {
    var t = GH.State.telemetry;
    var prev = GH.State.prevTelemetry;
    var th = GH.State.thresholds;

    var tsEl = $('telemetry-last-update');
    if (tsEl) tsEl.textContent = 'Обновлено: ' + formatTime(t.lastUpdated);

    var refillBtn = $('btn-refill-tank');
    if (refillBtn) {
      refillBtn.hidden = GH.State.settings.source !== 'sim';
    }

    CFG.SENSORS.forEach(function (s) {
      var val = t[s.key];
      var oldVal = prev[s.key];
      var valEl = $('sval-' + s.key);
      var trendEl = $('strend-' + s.key);
      var barEl = $('sbar-' + s.key);
      var bandEl = $('sband-' + s.key);
      var dotEl = $('sdot-' + s.key);
      var stextEl = $('sstext-' + s.key);
      var rangeEl = $('srange-' + s.key);

      if (valEl) valEl.textContent = Number(val).toFixed(s.decimals);

      if (trendEl) {
        var diff = val - oldVal;
        var eps = s.decimals > 0 ? 0.15 : 0.6;
        if (diff > eps) {
          trendEl.textContent = '↑';
          trendEl.style.color = '#10b981';
        } else if (diff < -eps) {
          trendEl.textContent = '↓';
          trendEl.style.color = '#f59e0b';
        } else {
          trendEl.textContent = '→';
          trendEl.style.color = 'var(--text-dim)';
        }
      }

      var pct = Math.max(0, Math.min(100, ((val - s.min) / (s.max - s.min)) * 100));
      if (barEl) barEl.style.width = pct.toFixed(1) + '%';

      var optMin = th[s.thresholdMinKey];
      var optMax = s.thresholdMaxKey ? th[s.thresholdMaxKey] : s.max;
      if (bandEl) {
        var leftPct = Math.max(0, ((optMin - s.min) / (s.max - s.min)) * 100);
        var widthPct = Math.max(2, ((optMax - optMin) / (s.max - s.min)) * 100);
        bandEl.style.left = leftPct.toFixed(1) + '%';
        bandEl.style.width = Math.min(100 - leftPct, widthPct).toFixed(1) + '%';
      }

      var st = evaluateSensorStatus(s, val, th);
      if (dotEl) dotEl.style.background = st.color;
      if (stextEl) {
        stextEl.textContent = st.text;
        stextEl.style.color = st.color;
      }
      if (rangeEl) {
        rangeEl.textContent =
          s.thresholdMaxKey
            ? 'Опт: ' + optMin + '–' + optMax + s.unit
            : 'Мин: ' + optMin + s.unit;
      }
    });

    // Water interlock banner
    var interlock = $('water-interlock-banner');
    if (interlock) {
      interlock.hidden = t.waterLevel > th.waterMinSafe;
    }

    // OLED 128x64 mirror
    if ($('oled-temp')) $('oled-temp').textContent = t.airTemp.toFixed(1) + 'C';
    if ($('oled-hum')) $('oled-hum').textContent = t.airHumidity + '%';
    if ($('oled-soil')) $('oled-soil').textContent = t.soilMoisture + '%';
    if ($('oled-water')) $('oled-water').textContent = t.waterLevel + '%';
    if ($('oled-light')) $('oled-light').textContent = t.lightLevel + '%';
    if ($('oled-mode')) $('oled-mode').textContent = GH.State.mode === 'auto' ? 'AUTO' : 'MANUAL';

    var act = GH.State.actuators;
    if ($('oled-acts')) {
      $('oled-acts').textContent =
        'P:' + (act.pump ? '1' : '0') +
        ' H:' + (act.heater ? '1' : '0') +
        ' M:' + (act.humidifier ? '1' : '0') +
        ' L:' + (act.light ? '1' : '0') +
        ' F:' + (act.fan ? '1' : '0');
    }

    if (activeTab === 'ai') {
      renderAiTelemetryContext();
    }
  }

  /* ================= ACTUATORS & CONTROL ================= */
  function buildActuatorsGrid() {
    var grid = $('actuators-grid');
    if (!grid) return;

    grid.innerHTML = CFG.ACTUATORS.map(function (a) {
      return (
        '<div class="actuator-card" id="act-card-' + a.key + '">' +
        '  <div class="act-head">' +
        '    <div class="act-icon">' + GH.SVG.getActuatorSVG(a.key) + '</div>' +
        '    <span class="act-state-pill" id="act-pill-' + a.key + '">ВЫКЛ</span>' +
        '  </div>' +
        '  <div>' +
        '    <div class="act-title">' + escapeHtml(a.label) + '</div>' +
        '    <div class="act-desc">' + escapeHtml(a.description) + '</div>' +
        '  </div>' +
        '  <div class="act-foot">' +
        '    <span class="act-gpio">' + escapeHtml(a.hardware + ' · ' + a.gpio) + '</span>' +
        '    <button type="button" class="toggle-switch" id="act-toggle-' + a.key + '" data-actuator="' + a.key + '" role="switch" aria-checked="false" aria-label="' + escapeHtml(a.label) + '"></button>' +
        '  </div>' +
        '</div>'
      );
    }).join('');
  }

  function renderControlState() {
    var isAuto = GH.State.mode === 'auto';
    var lowWater = GH.State.telemetry.waterLevel <= GH.State.thresholds.waterMinSafe;

    if ($('btn-mode-auto')) $('btn-mode-auto').classList.toggle('is-active', isAuto);
    if ($('btn-mode-manual')) $('btn-mode-manual').classList.toggle('is-active', !isAuto);
    if ($('btn-emergency-stop')) {
      $('btn-emergency-stop').disabled = isAuto;
      $('btn-emergency-stop').title = isAuto
        ? 'Доступно в ручном режиме'
        : 'Немедленно отключить все 5 каналов MOSFET';
    }
    if ($('oled-mode')) $('oled-mode').textContent = isAuto ? 'AUTO' : 'MANUAL';

    CFG.ACTUATORS.forEach(function (a) {
      var isOn = Boolean(GH.State.actuators[a.key]);
      var locked = lowWater && (a.key === 'pump' || a.key === 'humidifier');
      var card = $('act-card-' + a.key);
      var pill = $('act-pill-' + a.key);
      var sw = $('act-toggle-' + a.key);

      if (card) {
        card.classList.toggle('is-on', isOn);
        card.classList.toggle('is-locked', locked);
      }
      if (pill) {
        if (locked) {
          pill.textContent = 'БЛОК';
        } else {
          pill.textContent = (isAuto ? 'АВТО · ' : '') + (isOn ? 'ВКЛ' : 'ВЫКЛ');
        }
      }
      if (sw) {
        sw.classList.toggle('is-on', isOn);
        sw.classList.toggle('is-auto', isAuto);
        sw.setAttribute('aria-checked', isOn ? 'true' : 'false');
      }
    });

    // Update OLED actuators summary too
    var act = GH.State.actuators;
    if ($('oled-acts')) {
      $('oled-acts').textContent =
        'P:' + (act.pump ? '1' : '0') +
        ' H:' + (act.heater ? '1' : '0') +
        ' M:' + (act.humidifier ? '1' : '0') +
        ' L:' + (act.light ? '1' : '0') +
        ' F:' + (act.fan ? '1' : '0');
    }
  }

  function populateThresholdsForm() {
    var th = GH.State.thresholds;
    Object.keys(CFG.DEFAULT_THRESHOLDS).forEach(function (k) {
      var input = $('th-' + k);
      if (input) input.value = th[k];
    });
  }

  /* ================= EVENT LOG ================= */
  function renderLogs() {
    var list = $('event-log-list');
    if (!list) return;
    if (!GH.State.logs.length) {
      list.innerHTML = '<div class="log-item"><span class="log-time">--:--:--</span><span>Журнал пуст</span></div>';
      return;
    }
    list.innerHTML = GH.State.logs
      .map(function (entry) {
        return (
          '<div class="log-item log-item--' + escapeHtml(entry.level) + '">' +
          '  <span class="log-time">' + escapeHtml(formatTime(entry.ts)) + '</span>' +
          '  <span>' + escapeHtml(entry.text) + '</span>' +
          '</div>'
        );
      })
      .join('');
  }

  /* ================= CHARTS TAB ================= */
  function buildChartsGrid() {
    var grid = $('charts-grid');
    if (!grid) return;

    grid.innerHTML = CFG.SENSORS.map(function (s) {
      return (
        '<section class="panel chart-card">' +
        '  <div class="chart-card-head">' +
        '    <div>' +
        '      <h3 class="panel-title">' + escapeHtml(s.label) + '</h3>' +
        '      <span class="sensor-gpio">' + escapeHtml(s.hardware + ' · ' + s.gpio) + '</span>' +
        '    </div>' +
        '    <div class="chart-stats">' +
        '      <span>Тек: <strong id="chart-cur-' + s.key + '">--</strong></span>' +
        '      <span>Мин: <strong id="chart-min-' + s.key + '">--</strong></span>' +
        '      <span>Ср: <strong id="chart-avg-' + s.key + '">--</strong></span>' +
        '      <span>Макс: <strong id="chart-max-' + s.key + '">--</strong></span>' +
        '    </div>' +
        '  </div>' +
        '  <div class="chart-canvas-wrap">' +
        '    <canvas id="chart-' + s.key + '"></canvas>' +
        '  </div>' +
        '</section>'
      );
    }).join('');
  }

  /* ================= AI VISION TAB ================= */
  function renderAiEngineBadge() {
    var pill = $('ai-engine-pill');
    if (!pill) return;
    var hasKey = Boolean(GH.State.settings.gemini && GH.State.settings.gemini.apiKey.trim());
    if (hasKey) {
      pill.textContent = 'Режим: Google Gemini Vision (' + GH.State.settings.gemini.model + ')';
      pill.classList.add('is-gemini');
    } else {
      pill.textContent = 'Режим: Локальный цветовой демо-анализ (без API-ключа)';
      pill.classList.remove('is-gemini');
    }
  }

  function renderAiPlantSelect() {
    var sel = $('ai-plant-select');
    var inlineNew = $('ai-new-plant-inline');
    if (!sel) return;

    var plants = GH.State.plants;
    var optionsHtml = plants
      .map(function (p) {
        return '<option value="' + escapeHtml(p.id) + '">' + escapeHtml(p.name) + (p.species ? ' (' + escapeHtml(p.species) + ')' : '') + '</option>';
      })
      .join('');

    if (plants.length < CFG.MAX_PLANTS) {
      optionsHtml += '<option value="__new__">+ Добавить новое растение в слот ' + (plants.length + 1) + ' из ' + CFG.MAX_PLANTS + '</option>';
    }

    sel.innerHTML = optionsHtml;

    if (GH.State.selectedPlantId && plants.some(function (p) { return p.id === GH.State.selectedPlantId; })) {
      sel.value = GH.State.selectedPlantId;
    } else if (plants[0]) {
      sel.value = plants[0].id;
      GH.State.selectedPlantId = plants[0].id;
    } else {
      sel.value = '__new__';
    }

    if (inlineNew) {
      inlineNew.hidden = sel.value !== '__new__';
    }
  }

  function renderAiTelemetryContext() {
    var box = $('ai-telemetry-snapshot');
    if (!box) return;
    var t = GH.State.telemetry;
    box.textContent =
      'Контекст теплицы для ИИ: Воздух ' +
      t.airTemp.toFixed(1) + '°C · Влажн. ' + t.airHumidity + '% · Почва ' +
      t.soilMoisture + '% · Свет ' + t.lightLevel + '% · Бак ' + t.waterLevel + '%';
  }

  function renderAiHistory() {
    var list = $('ai-history-list');
    if (!list) return;
    var sel = $('ai-plant-select');
    var id = sel ? sel.value : GH.State.selectedPlantId;
    var plant = GH.State.plants.find(function (p) {
      return p.id === id;
    });

    if (!plant || !Array.isArray(plant.scans) || plant.scans.length === 0) {
      list.innerHTML = '<div class="panel-subtitle">Для выбранного растения сохранённых фото-проверок пока нет.</div>';
      return;
    }

    list.innerHTML = plant.scans
      .map(function (sc) {
        var meta = CFG.STATUS_META[sc.status] || CFG.STATUS_META.unknown;
        var thumbMarkup = sc.thumb
          ? '<img class="history-thumb" src="' + sc.thumb + '" alt="Миниатюра" />'
          : '<div class="history-thumb" style="display:grid;place-items:center;font-size:0.7rem;color:var(--text-dim)">SVG</div>';
        return (
          '<div class="history-item">' +
          thumbMarkup +
          '  <div class="history-body">' +
          '    <div class="history-top">' +
          '      <span>' + sc.healthScore + '% · ' + meta.label + '</span>' +
          '      <span class="mono-tag">' + escapeHtml(formatDateTime(sc.ts)) + '</span>' +
          '    </div>' +
          '    <div class="history-desc">' + escapeHtml(sc.summary || sc.diagnosis) + '</div>' +
          '  </div>' +
          '</div>'
        );
      })
      .join('');
  }

  function renderAiReport(result) {
    var empty = $('ai-result-empty');
    var loading = $('ai-result-loading');
    var card = $('ai-result-card');
    if (!card) return;

    if (empty) empty.hidden = true;
    if (loading) loading.hidden = true;
    card.hidden = false;

    var circumference = 314.16;
    var offset = circumference * (1 - Math.max(0, Math.min(100, result.healthScore)) / 100);
    var arc = $('ai-gauge-arc');
    if (arc) {
      arc.style.strokeDashoffset = offset.toFixed(2);
      arc.style.stroke = getScoreBarColor(result.status);
    }

    if ($('ai-gauge-score')) $('ai-gauge-score').textContent = result.healthScore + '%';

    var meta = CFG.STATUS_META[result.status] || CFG.STATUS_META.unknown;
    var pill = $('ai-result-status-pill');
    if (pill) {
      pill.textContent = meta.label;
      pill.className = 'status-pill ' + meta.badgeClass;
    }

    if ($('ai-result-engine-tag')) {
      $('ai-result-engine-tag').textContent =
        result.engine === 'gemini' ? 'Gemini Vision' : 'Локальный демо-анализ';
    }
    if ($('ai-result-species')) {
      $('ai-result-species').textContent = result.speciesGuess ? 'Распознанная культура: ' + result.speciesGuess : '';
    }
    if ($('ai-result-summary')) $('ai-result-summary').textContent = result.summary || '';
    if ($('ai-result-diagnosis')) $('ai-result-diagnosis').textContent = result.diagnosis || '';

    var symWrap = $('ai-result-symptoms');
    if (symWrap) {
      symWrap.innerHTML = (result.symptoms || [])
        .map(function (sym) {
          return '<span class="symptom-tag">' + escapeHtml(sym) + '</span>';
        })
        .join('');
    }

    var recWrap = $('ai-result-recommendations');
    if (recWrap) {
      recWrap.innerHTML = (result.recommendations || [])
        .map(function (rec) {
          return '<li>' + escapeHtml(rec) + '</li>';
        })
        .join('');
    }
  }

  function handleSelectedImageFile(file) {
    if (!file || !file.type || file.type.indexOf('image/') !== 0) {
      showToast('Пожалуйста, выберите файл изображения (JPG, PNG, WEBP).', 'warn');
      return;
    }
    GH.AIVision.prepareImage(file)
      .then(function (prepared) {
        pendingImage = prepared;
        if ($('ai-preview-img')) $('ai-preview-img').src = prepared.previewUrl;
        if ($('ai-dropzone-empty')) $('ai-dropzone-empty').hidden = true;
        if ($('ai-preview-wrap')) $('ai-preview-wrap').hidden = false;
        if ($('btn-ai-analyze')) $('btn-ai-analyze').disabled = false;
      })
      .catch(function (err) {
        showToast(err.message || 'Не удалось открыть фото', 'alert');
      });
  }

  function clearPendingPhoto() {
    pendingImage = null;
    if ($('ai-file-input')) $('ai-file-input').value = '';
    if ($('ai-preview-img')) $('ai-preview-img').removeAttribute('src');
    if ($('ai-dropzone-empty')) $('ai-dropzone-empty').hidden = false;
    if ($('ai-preview-wrap')) $('ai-preview-wrap').hidden = true;
    if ($('btn-ai-analyze')) $('btn-ai-analyze').disabled = true;
  }

  function runAiAnalysis() {
    if (!pendingImage) {
      showToast('Сначала загрузите фотографию растения.', 'warn');
      return;
    }

    var sel = $('ai-plant-select');
    var targetId = sel ? sel.value : '';

    if (targetId === '__new__') {
      var newName = ($('ai-new-plant-name') ? $('ai-new-plant-name').value : '').trim();
      var newSpecies = ($('ai-new-plant-species') ? $('ai-new-plant-species').value : '').trim();
      if (!newName) {
        showToast('Укажите название нового растения.', 'warn');
        if ($('ai-new-plant-name')) $('ai-new-plant-name').focus();
        return;
      }
      var created = GH.State.addPlant({ name: newName, species: newSpecies, notes: '' });
      if (created.error) {
        showToast(created.error, 'alert');
        return;
      }
      targetId = created.plant.id;
      if ($('ai-new-plant-name')) $('ai-new-plant-name').value = '';
      if ($('ai-new-plant-species')) $('ai-new-plant-species').value = '';
      renderAiPlantSelect();
    }

    var plant = GH.State.plants.find(function (p) {
      return p.id === targetId;
    });
    if (!plant) {
      showToast('Выберите растение из базы теплицы.', 'warn');
      return;
    }

    if ($('ai-result-empty')) $('ai-result-empty').hidden = true;
    if ($('ai-result-card')) $('ai-result-card').hidden = true;
    if ($('ai-result-loading')) $('ai-result-loading').hidden = false;
    if ($('btn-ai-analyze')) $('btn-ai-analyze').disabled = true;

    var geminiCfg = GH.State.settings.gemini || {};
    var apiKey = String(geminiCfg.apiKey || '').trim();
    var telemetrySnap = Object.assign({}, GH.State.telemetry);

    var promise;
    if (apiKey) {
      promise = GH.AIVision.analyzeWithGemini(
        pendingImage.base64Jpeg,
        apiKey,
        geminiCfg.model,
        plant.name,
        telemetrySnap
      );
    } else {
      promise = new Promise(function (resolve) {
        setTimeout(function () {
          resolve(GH.AIVision.analyzeLocallyDemo(pendingImage.img, plant.name, telemetrySnap));
        }, 450);
      });
    }

    promise
      .then(function (result) {
        GH.State.recordPlantScan(plant.id, result, pendingImage.thumbUrl);
        renderAiReport(result);
        renderAiHistory();
        showToast('Состояние «' + plant.name + '» обновлено: ' + result.healthScore + '%');
      })
      .catch(function (err) {
        if ($('ai-result-loading')) $('ai-result-loading').hidden = true;
        if ($('ai-result-empty')) $('ai-result-empty').hidden = false;
        showToast(err.message || 'Ошибка анализа фото', 'alert');
      })
      .finally(function () {
        if ($('btn-ai-analyze')) $('btn-ai-analyze').disabled = !pendingImage;
      });
  }

  /* ================= MODALS ================= */
  function openSettingsModal() {
    var s = GH.State.settings;
    var radios = document.querySelectorAll('input[name="data-source"]');
    radios.forEach(function (r) {
      r.checked = r.value === s.source;
    });
    if ($('cfg-mqtt-broker')) $('cfg-mqtt-broker').value = s.mqtt.brokerUrl || '';
    if ($('cfg-mqtt-prefix')) $('cfg-mqtt-prefix').value = s.mqtt.topicPrefix || '';
    if ($('cfg-mqtt-user')) $('cfg-mqtt-user').value = s.mqtt.username || '';
    if ($('cfg-mqtt-pass')) $('cfg-mqtt-pass').value = s.mqtt.password || '';
    if ($('cfg-gemini-key')) $('cfg-gemini-key').value = s.gemini.apiKey || '';
    if ($('cfg-gemini-model')) $('cfg-gemini-model').value = s.gemini.model || 'gemini-2.5-flash';

    renderConnection();
    $('modal-settings').hidden = false;
  }

  function closeSettingsModal() {
    $('modal-settings').hidden = true;
  }

  function saveSettingsFromModal() {
    var selectedRadio = document.querySelector('input[name="data-source"]:checked');
    var source = selectedRadio ? selectedRadio.value : 'sim';

    var mqttPatch = {
      brokerUrl: ($('cfg-mqtt-broker').value || '').trim() || CFG.DEFAULT_SETTINGS.mqtt.brokerUrl,
      topicPrefix: ($('cfg-mqtt-prefix').value || '').trim() || CFG.DEFAULT_SETTINGS.mqtt.topicPrefix,
      username: ($('cfg-mqtt-user').value || '').trim(),
      password: $('cfg-mqtt-pass').value || ''
    };
    var geminiPatch = {
      apiKey: ($('cfg-gemini-key').value || '').trim(),
      model: $('cfg-gemini-model').value || 'gemini-2.5-flash'
    };

    GH.State.updateSettings({
      source: source,
      mqtt: mqttPatch,
      gemini: geminiPatch
    });

    if (source === 'mqtt') {
      GH.Simulator.stop();
      GH.Mqtt.connect(mqttPatch);
    } else {
      GH.Mqtt.disconnect();
      GH.State.setConnection({
        status: 'sim',
        espOnline: false,
        message: 'Локальный симулятор теплицы'
      });
      GH.Simulator.start();
    }

    renderAiEngineBadge();
    renderTelemetry();
    closeSettingsModal();
    showToast('Настройки сохранены');
  }

  function openPlantModal(plantId) {
    var isNew = !plantId;
    if (isNew && GH.State.plants.length >= CFG.MAX_PLANTS) {
      showToast('Максимум ' + CFG.MAX_PLANTS + ' растений в теплице.', 'warn');
      return;
    }

    $('pm-id').value = plantId || '';
    $('modal-plant-title').textContent = isNew ? 'Добавить растение в теплицу' : 'Карточка растения';
    $('btn-delete-plant').hidden = isNew;
    $('btn-go-ai-from-modal').hidden = isNew;
    $('pm-scan-preview-section').hidden = isNew;

    if (isNew) {
      $('pm-name').value = '';
      $('pm-species').value = '';
      $('pm-notes').value = '';
    } else {
      var plant = GH.State.plants.find(function (p) {
        return p.id === plantId;
      });
      if (!plant) return;
      $('pm-name').value = plant.name || '';
      $('pm-species').value = plant.species || '';
      $('pm-notes').value = plant.notes || '';

      var meta = CFG.STATUS_META[plant.status] || CFG.STATUS_META.unknown;
      $('pm-svg-preview').innerHTML = plant.lastThumb
        ? '<img src="' + plant.lastThumb + '" alt="Последнее фото" />'
        : GH.SVG.getPlantSVG(plant.status, plant.healthScore);
      $('pm-score-line').textContent =
        (plant.healthScore !== null ? plant.healthScore + '% · ' : '') + meta.label;
      $('pm-last-diagnosis').textContent = plant.lastDiagnosis || 'Фотографии ещё не загружались.';
    }

    $('modal-plant').hidden = false;
  }

  function closePlantModal() {
    $('modal-plant').hidden = true;
  }

  /* ================= EVENTS WIRING ================= */
  function bindEvents() {
    // Tabs
    document.querySelectorAll('.nav-tab[data-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        switchTab(btn.getAttribute('data-tab'));
      });
    });

    // Theme toggle
    $('btn-theme-toggle').addEventListener('click', function () {
      var nextTheme = GH.State.settings.theme === 'light' ? 'dark' : 'light';
      GH.State.updateSettings({ theme: nextTheme });
      applyTheme(nextTheme);
    });

    // Settings open/close
    $('btn-open-settings').addEventListener('click', openSettingsModal);
    $('connection-pill').addEventListener('click', openSettingsModal);
    $('btn-ai-open-settings').addEventListener('click', openSettingsModal);
    $('btn-close-settings').addEventListener('click', closeSettingsModal);
    $('btn-save-settings').addEventListener('click', saveSettingsFromModal);

    // MQTT quick actions inside Settings
    document.querySelectorAll('[data-mqtt-preset]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-mqtt-preset');
        if (CFG.MQTT_PRESETS[key]) {
          $('cfg-mqtt-broker').value = CFG.MQTT_PRESETS[key];
        }
      });
    });

    $('btn-mqtt-connect').addEventListener('click', function () {
      var mqttRadio = document.querySelector('input[name="data-source"][value="mqtt"]');
      if (mqttRadio) mqttRadio.checked = true;
      var cfg = {
        brokerUrl: ($('cfg-mqtt-broker').value || '').trim(),
        topicPrefix: ($('cfg-mqtt-prefix').value || '').trim() || CFG.DEFAULT_SETTINGS.mqtt.topicPrefix,
        username: ($('cfg-mqtt-user').value || '').trim(),
        password: $('cfg-mqtt-pass').value || ''
      };
      GH.State.updateSettings({ source: 'mqtt', mqtt: cfg });
      GH.Simulator.stop();
      GH.Mqtt.connect(cfg);
    });

    $('btn-mqtt-disconnect').addEventListener('click', function () {
      GH.Mqtt.disconnect();
    });

    $('btn-toggle-key-vis').addEventListener('click', function () {
      var inp = $('cfg-gemini-key');
      var isPwd = inp.type === 'password';
      inp.type = isPwd ? 'text' : 'password';
      $('btn-toggle-key-vis').textContent = isPwd ? 'Скрыть' : 'Показать';
    });

    $('btn-clear-gemini-key').addEventListener('click', function () {
      $('cfg-gemini-key').value = '';
      GH.State.updateSettings({
        gemini: { apiKey: '', model: $('cfg-gemini-model').value }
      });
      renderAiEngineBadge();
      showToast('API-ключ Gemini удалён из браузера');
    });

    // Plants Bay actions
    $('btn-add-plant').addEventListener('click', function () {
      openPlantModal(null);
    });

    $('plants-grid').addEventListener('click', function (ev) {
      var emptySlot = ev.target.closest('#btn-empty-add-plant');
      if (emptySlot) {
        openPlantModal(null);
        return;
      }
      var btn = ev.target.closest('[data-action]');
      if (!btn) return;
      var action = btn.getAttribute('data-action');
      var id = btn.getAttribute('data-id');
      if (action === 'scan-plant') {
        GH.State.selectedPlantId = id;
        switchTab('ai');
      } else if (action === 'edit-plant') {
        openPlantModal(id);
      }
    });

    // Plant Modal
    $('btn-close-plant-modal').addEventListener('click', closePlantModal);
    $('plant-form').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var id = $('pm-id').value;
      var payload = {
        name: $('pm-name').value.trim(),
        species: $('pm-species').value.trim(),
        notes: $('pm-notes').value.trim()
      };
      if (!payload.name) return;

      if (id) {
        GH.State.updatePlant(id, payload);
        showToast('Карточка растения обновлена');
      } else {
        var res = GH.State.addPlant(payload);
        if (res.error) {
          showToast(res.error, 'alert');
          return;
        }
        showToast('Растение добавлено в теплицу');
      }
      closePlantModal();
    });

    $('btn-delete-plant').addEventListener('click', function () {
      var id = $('pm-id').value;
      if (!id) return;
      GH.State.deletePlant(id);
      closePlantModal();
      showToast('Растение удалено', 'warn');
    });

    $('btn-go-ai-from-modal').addEventListener('click', function () {
      var id = $('pm-id').value;
      closePlantModal();
      if (id) GH.State.selectedPlantId = id;
      switchTab('ai');
    });

    // Refill simulator tank button (delegated)
    $('sensors-grid').addEventListener('click', function (ev) {
      if (ev.target && ev.target.id === 'btn-refill-tank') {
        GH.Simulator.refillWaterTank();
        showToast('Бак пополнен до 100%');
      }
    });

    // Mode switch
    $('btn-mode-auto').addEventListener('click', function () {
      GH.State.setMode('auto');
      GH.Controller.applyAutoIfEnabled();
      if (GH.State.settings.source === 'mqtt') GH.Mqtt.publishControl();
    });

    $('btn-mode-manual').addEventListener('click', function () {
      GH.State.setMode('manual');
      if (GH.State.settings.source === 'mqtt') GH.Mqtt.publishControl();
    });

    // Thresholds panel toggle & save
    $('btn-toggle-thresholds').addEventListener('click', function () {
      var p = $('thresholds-panel');
      p.hidden = !p.hidden;
    });

    $('btn-save-thresholds').addEventListener('click', function () {
      var next = {};
      Object.keys(CFG.DEFAULT_THRESHOLDS).forEach(function (k) {
        var val = Number($('th-' + k).value);
        next[k] = Number.isNaN(val) ? CFG.DEFAULT_THRESHOLDS[k] : val;
      });
      if (next.tempMin >= next.tempMax) next.tempMax = next.tempMin + 2;
      if (next.humMin >= next.humMax) next.humMax = next.humMin + 5;
      if (next.soilMin >= next.soilMax) next.soilMax = next.soilMin + 5;

      GH.State.updateThresholds(next);
      populateThresholdsForm();
      GH.Controller.applyAutoIfEnabled();
      if (GH.State.settings.source === 'mqtt') GH.Mqtt.publishControl();
      renderTelemetry();
      showToast('Уставки автоматики применены');
    });

    $('btn-reset-thresholds').addEventListener('click', function () {
      GH.State.resetThresholds();
      populateThresholdsForm();
      GH.Controller.applyAutoIfEnabled();
      renderTelemetry();
      showToast('Уставки сброшены к значениям по умолчанию');
    });

    // Emergency Stop
    $('btn-emergency-stop').addEventListener('click', function () {
      if (GH.State.mode === 'auto') {
        showToast('Переключитесь в РУЧНОЙ режим для аварийного стопа.', 'warn');
        return;
      }
      GH.State.setAllActuators(
        { pump: false, heater: false, humidifier: false, light: false, fan: false },
        true
      );
      GH.State.addLog('alert', 'АВАРИЙНЫЙ СТОП: все 5 MOSFET-каналов выключены вручную');
      if (GH.State.settings.source === 'mqtt') GH.Mqtt.publishControl();
      showToast('Все исполнительные модули остановлены', 'alert');
    });

    // Actuator toggles
    $('actuators-grid').addEventListener('click', function (ev) {
      var sw = ev.target.closest('[data-actuator]');
      if (!sw) return;
      var key = sw.getAttribute('data-actuator');

      if (GH.State.mode === 'auto') {
        showToast('Сейчас включён АВТОМАТИЧЕСКИЙ режим. Переключите на РУЧНОЙ для ручного управления.', 'warn');
        return;
      }

      if (
        (key === 'pump' || key === 'humidifier') &&
        !GH.State.actuators[key] &&
        GH.State.telemetry.waterLevel <= GH.State.thresholds.waterMinSafe
      ) {
        showToast('Защита от сухого хода: в баке недостаточно воды!', 'alert');
        return;
      }

      GH.State.setActuator(key, !GH.State.actuators[key], false);
      if (GH.State.settings.source === 'mqtt') GH.Mqtt.publishControl();
    });

    // Event log clear
    $('btn-clear-logs').addEventListener('click', function () {
      GH.State.clearLogs();
    });

    // Charts controls
    document.querySelectorAll('.seg-btn[data-range]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.seg-btn[data-range]').forEach(function (b) {
          b.classList.remove('is-active');
        });
        btn.classList.add('is-active');
        GH.State.chartRange = btn.getAttribute('data-range');
        GH.Charts.update();
      });
    });

    $('btn-charts-pause').addEventListener('click', function () {
      GH.State.historyPaused = !GH.State.historyPaused;
      $('btn-charts-pause').textContent = GH.State.historyPaused ? 'Возобновить запись' : 'Пауза записи';
      showToast(GH.State.historyPaused ? 'Запись истории на графики приостановлена' : 'Запись истории возобновлена');
    });

    $('btn-export-csv').addEventListener('click', function () {
      GH.Charts.exportCSV();
      showToast('CSV-файл телеметрии экспортирован');
    });

    $('btn-clear-history').addEventListener('click', function () {
      GH.State.clearHistory();
      showToast('История телеметрии очищена');
    });

    // AI Tab controls
    $('ai-plant-select').addEventListener('change', function () {
      var val = $('ai-plant-select').value;
      $('ai-new-plant-inline').hidden = val !== '__new__';
      if (val !== '__new__') {
        GH.State.selectedPlantId = val;
      }
      renderAiHistory();
    });

    var dz = $('ai-dropzone');
    var fileInp = $('ai-file-input');

    dz.addEventListener('click', function (ev) {
      if (ev.target && ev.target.id === 'btn-ai-clear-photo') return;
      fileInp.click();
    });

    dz.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        fileInp.click();
      }
    });

    dz.addEventListener('dragover', function (ev) {
      ev.preventDefault();
      dz.classList.add('is-dragover');
    });

    dz.addEventListener('dragleave', function () {
      dz.classList.remove('is-dragover');
    });

    dz.addEventListener('drop', function (ev) {
      ev.preventDefault();
      dz.classList.remove('is-dragover');
      var file = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0];
      if (file) handleSelectedImageFile(file);
    });

    fileInp.addEventListener('change', function () {
      var file = fileInp.files && fileInp.files[0];
      if (file) handleSelectedImageFile(file);
    });

    $('btn-ai-clear-photo').addEventListener('click', function (ev) {
      ev.stopPropagation();
      clearPendingPhoto();
    });

    $('btn-ai-analyze').addEventListener('click', runAiAnalysis);

    // Close modals on backdrop click or Escape
    ['modal-settings', 'modal-plant'].forEach(function (modalId) {
      $(modalId).addEventListener('click', function (ev) {
        if (ev.target === $(modalId)) $(modalId).hidden = true;
      });
    });

    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') {
        closeSettingsModal();
        closePlantModal();
      }
    });
  }

  /* ================= STATE SUBSCRIPTIONS & INIT ================= */
  function init() {
    applyTheme(GH.State.settings.theme);

    buildSensorsGrid();
    buildActuatorsGrid();
    buildChartsGrid();
    populateThresholdsForm();

    renderPlants();
    renderTelemetry();
    renderControlState();
    renderLogs();
    renderConnection();
    renderAiEngineBadge();
    renderAiPlantSelect();
    renderAiTelemetryContext();
    renderAiHistory();

    GH.State.subscribe('telemetry', function () {
      renderTelemetry();
      if (activeTab === 'charts' && GH.Charts) {
        GH.Charts.update();
      }
    });
    GH.State.subscribe('historyCleared', function () {
      if (GH.Charts) GH.Charts.update();
    });
    GH.State.subscribe('mode', renderControlState);
    GH.State.subscribe('actuators', renderControlState);
    GH.State.subscribe('plants', function () {
      renderPlants();
      if (activeTab === 'ai') {
        renderAiPlantSelect();
        renderAiHistory();
      }
    });
    GH.State.subscribe('logs', renderLogs);
    GH.State.subscribe('connection', renderConnection);

    bindEvents();

    if (GH.State.settings.source === 'mqtt') {
      GH.Mqtt.connect(GH.State.settings.mqtt);
    } else {
      GH.Simulator.start();
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
