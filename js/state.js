(function () {
  'use strict';

  var GH = (window.GH = window.GH || {});
  var CFG = GH.CONFIG;

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function safeParse(raw, fallback) {
    if (!raw) return fallback;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function loadStorage(key, fallback) {
    try {
      return safeParse(window.localStorage.getItem(key), fallback);
    } catch (e) {
      return fallback;
    }
  }

  function saveStorage(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }

  function seedInitialHistory() {
    var now = Date.now();
    var points = [];
    for (var i = 23; i >= 0; i--) {
      var ts = now - i * 5000;
      var phase = (24 - i) * 0.28;
      points.push({
        ts: ts,
        airTemp: Number((23.4 + Math.sin(phase) * 0.9).toFixed(1)),
        airHumidity: Math.round(62 + Math.cos(phase * 0.8) * 4),
        soilMoisture: Math.round(44 - (24 - i) * 0.12 + Math.sin(phase * 0.5) * 1.5),
        waterLevel: Math.round(78 - (24 - i) * 0.05),
        lightLevel: Math.round(68 + Math.sin(phase * 0.6) * 8)
      });
    }
    return points;
  }

  function scoreToStatus(score) {
    if (score === null || score === undefined || Number.isNaN(Number(score))) {
      return 'unknown';
    }
    var n = Number(score);
    if (n >= 80) return 'healthy';
    if (n >= 55) return 'attention';
    if (n >= 30) return 'sick';
    return 'critical';
  }

  var savedSettings = loadStorage(CFG.STORAGE_KEYS.SETTINGS, null);
  var initialSettings = deepClone(CFG.DEFAULT_SETTINGS);
  if (savedSettings && typeof savedSettings === 'object') {
    initialSettings.theme = savedSettings.theme === 'light' ? 'light' : 'dark';
    initialSettings.source = savedSettings.source === 'mqtt' ? 'mqtt' : 'sim';
    if (savedSettings.mqtt) {
      initialSettings.mqtt = Object.assign({}, initialSettings.mqtt, savedSettings.mqtt);
    }
    if (savedSettings.gemini) {
      initialSettings.gemini = Object.assign({}, initialSettings.gemini, savedSettings.gemini);
    }
  }

  var savedThresholds = loadStorage(CFG.STORAGE_KEYS.THRESHOLDS, null);
  var initialThresholds = Object.assign(
    {},
    CFG.DEFAULT_THRESHOLDS,
    savedThresholds && typeof savedThresholds === 'object' ? savedThresholds : {}
  );

  var savedPlants = loadStorage(CFG.STORAGE_KEYS.PLANTS, null);
  var initialPlants = Array.isArray(savedPlants)
    ? savedPlants.slice(0, CFG.MAX_PLANTS)
    : deepClone(CFG.STARTER_PLANTS);

  var savedHistory = loadStorage(CFG.STORAGE_KEYS.HISTORY, null);
  var initialHistory =
    Array.isArray(savedHistory) && savedHistory.length > 0
      ? savedHistory.slice(-CFG.HISTORY_LIMIT)
      : seedInitialHistory();

  var lastPoint = initialHistory[initialHistory.length - 1] || {
    ts: Date.now(),
    airTemp: 23.5,
    airHumidity: 62,
    soilMoisture: 43,
    waterLevel: 77,
    lightLevel: 68
  };

  var savedMode = loadStorage(CFG.STORAGE_KEYS.MODE, 'auto');
  var savedActuators = loadStorage(CFG.STORAGE_KEYS.ACTUATORS, null);
  var initialActuators = Object.assign(
    { pump: false, heater: false, humidifier: false, light: false, fan: false },
    savedActuators && typeof savedActuators === 'object' ? savedActuators : {}
  );

  var listeners = {};

  function emit(eventName, payload) {
    var list = listeners[eventName] || [];
    for (var i = 0; i < list.length; i++) {
      try {
        list[i](payload);
      } catch (err) {
        console.error('State listener error on', eventName, err);
      }
    }
  }

  GH.State = {
    telemetry: {
      airTemp: lastPoint.airTemp,
      airHumidity: lastPoint.airHumidity,
      soilMoisture: lastPoint.soilMoisture,
      waterLevel: lastPoint.waterLevel,
      lightLevel: lastPoint.lightLevel,
      lastUpdated: lastPoint.ts || Date.now()
    },
    prevTelemetry: {
      airTemp: lastPoint.airTemp,
      airHumidity: lastPoint.airHumidity,
      soilMoisture: lastPoint.soilMoisture,
      waterLevel: lastPoint.waterLevel,
      lightLevel: lastPoint.lightLevel
    },
    mode: savedMode === 'manual' ? 'manual' : 'auto',
    actuators: initialActuators,
    thresholds: initialThresholds,
    history: initialHistory,
    historyPaused: false,
    chartRange: 'all',
    plants: initialPlants,
    selectedPlantId: initialPlants[0] ? initialPlants[0].id : '',
    settings: initialSettings,
    connection: {
      status: initialSettings.source === 'mqtt' ? 'disconnected' : 'sim',
      espOnline: false,
      message:
        initialSettings.source === 'mqtt'
          ? 'Ожидание подключения к MQTT-брокеру'
          : 'Локальный симулятор теплицы'
    },
    logs: [
      {
        ts: Date.now(),
        level: 'ok',
        text: 'SCADA-интерфейс теплицы инициализирован'
      }
    ],

    scoreToStatus: scoreToStatus,

    subscribe: function (eventName, callback) {
      if (!listeners[eventName]) listeners[eventName] = [];
      listeners[eventName].push(callback);
      return function unsubscribe() {
        listeners[eventName] = (listeners[eventName] || []).filter(function (fn) {
          return fn !== callback;
        });
      };
    },

    addLog: function (level, text) {
      var entry = {
        ts: Date.now(),
        level: level || 'info',
        text: text
      };
      this.logs.unshift(entry);
      if (this.logs.length > CFG.LOG_LIMIT) {
        this.logs.length = CFG.LOG_LIMIT;
      }
      if (GH.Supabase && GH.Supabase.isReady()) {
        GH.Supabase.pushLog(entry);
      }
      emit('logs', this.logs);
    },

    clearLogs: function () {
      this.logs = [];
      if (GH.Supabase && GH.Supabase.isReady()) {
        GH.Supabase.clearLogs();
      }
      emit('logs', this.logs);
    },

    updateTelemetry: function (nextValues, recordHistory) {
      this.prevTelemetry = {
        airTemp: this.telemetry.airTemp,
        airHumidity: this.telemetry.airHumidity,
        soilMoisture: this.telemetry.soilMoisture,
        waterLevel: this.telemetry.waterLevel,
        lightLevel: this.telemetry.lightLevel
      };

      var now = Date.now();
      this.telemetry.airTemp = Number(Number(nextValues.airTemp).toFixed(1));
      this.telemetry.airHumidity = Math.round(Number(nextValues.airHumidity));
      this.telemetry.soilMoisture = Math.round(Number(nextValues.soilMoisture));
      this.telemetry.waterLevel = Math.round(Number(nextValues.waterLevel));
      this.telemetry.lightLevel = Math.round(Number(nextValues.lightLevel));
      this.telemetry.lastUpdated = now;

      if (recordHistory !== false && !this.historyPaused) {
        this.history.push({
          ts: now,
          airTemp: this.telemetry.airTemp,
          airHumidity: this.telemetry.airHumidity,
          soilMoisture: this.telemetry.soilMoisture,
          waterLevel: this.telemetry.waterLevel,
          lightLevel: this.telemetry.lightLevel
        });
        if (this.history.length > CFG.HISTORY_LIMIT) {
          this.history = this.history.slice(-CFG.HISTORY_LIMIT);
        }
        saveStorage(CFG.STORAGE_KEYS.HISTORY, this.history);
        if (GH.Supabase && GH.Supabase.isReady()) {
          GH.Supabase.pushTelemetry(this.telemetry, this.settings.source);
        }
      }

      emit('telemetry', this.telemetry);
    },

    clearHistory: function () {
      this.history = [
        {
          ts: Date.now(),
          airTemp: this.telemetry.airTemp,
          airHumidity: this.telemetry.airHumidity,
          soilMoisture: this.telemetry.soilMoisture,
          waterLevel: this.telemetry.waterLevel,
          lightLevel: this.telemetry.lightLevel
        }
      ];
      saveStorage(CFG.STORAGE_KEYS.HISTORY, this.history);
      if (GH.Supabase && GH.Supabase.isReady()) {
        GH.Supabase.clearTelemetry();
      }
      emit('historyCleared', this.history);
    },

    setMode: function (mode) {
      var normalized = mode === 'manual' ? 'manual' : 'auto';
      if (this.mode === normalized) return;
      this.mode = normalized;
      saveStorage(CFG.STORAGE_KEYS.MODE, this.mode);
      this.addLog(
        'info',
        normalized === 'auto'
          ? 'Режим управления переключён на АВТОМАТИЧЕСКИЙ'
          : 'Режим управления переключён на РУЧНОЙ'
      );
      if (GH.Supabase && GH.Supabase.isReady()) {
        GH.Supabase.saveConfig(this);
      }
      emit('mode', this.mode);
    },

    setActuator: function (key, value, silent) {
      if (!(key in this.actuators)) return false;
      var nextVal = Boolean(value);
      if (this.actuators[key] === nextVal) return false;
      this.actuators[key] = nextVal;
      saveStorage(CFG.STORAGE_KEYS.ACTUATORS, this.actuators);
      if (!silent) {
        var meta = CFG.ACTUATORS.find(function (a) {
          return a.key === key;
        });
        this.addLog(
          nextVal ? 'ok' : 'info',
          (meta ? meta.label : key) + ': ' + (nextVal ? 'ВКЛ' : 'ВЫКЛ')
        );
      }
      if (GH.Supabase && GH.Supabase.isReady()) {
        GH.Supabase.saveConfig(this);
      }
      emit('actuators', this.actuators);
      return true;
    },

    setAllActuators: function (nextMap, silent) {
      var changed = false;
      var keys = Object.keys(this.actuators);
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        if (k in nextMap) {
          var v = Boolean(nextMap[k]);
          if (this.actuators[k] !== v) {
            this.actuators[k] = v;
            changed = true;
            if (!silent) {
              var meta = CFG.ACTUATORS.find(function (a) {
                return a.key === k;
              });
              this.addLog(
                v ? 'ok' : 'info',
                '[Авто] ' + (meta ? meta.label : k) + ': ' + (v ? 'ВКЛ' : 'ВЫКЛ')
              );
            }
          }
        }
      }
      if (changed) {
        saveStorage(CFG.STORAGE_KEYS.ACTUATORS, this.actuators);
        if (GH.Supabase && GH.Supabase.isReady()) {
          GH.Supabase.saveConfig(this);
        }
        emit('actuators', this.actuators);
      }
      return changed;
    },

    updateThresholds: function (nextThresholds) {
      this.thresholds = Object.assign({}, this.thresholds, nextThresholds);
      saveStorage(CFG.STORAGE_KEYS.THRESHOLDS, this.thresholds);
      this.addLog('info', 'Уставки автоматического режима обновлены');
      if (GH.Supabase && GH.Supabase.isReady()) {
        GH.Supabase.saveConfig(this);
      }
      emit('thresholds', this.thresholds);
    },

    resetThresholds: function () {
      this.thresholds = Object.assign({}, CFG.DEFAULT_THRESHOLDS);
      saveStorage(CFG.STORAGE_KEYS.THRESHOLDS, this.thresholds);
      this.addLog('info', 'Уставки автоматики сброшены к заводским значениям');
      if (GH.Supabase && GH.Supabase.isReady()) {
        GH.Supabase.saveConfig(this);
      }
      emit('thresholds', this.thresholds);
    },

    updateSettings: function (patch) {
      if (patch.theme) this.settings.theme = patch.theme;
      if (patch.source) this.settings.source = patch.source;
      if (patch.mqtt) {
        this.settings.mqtt = Object.assign({}, this.settings.mqtt, patch.mqtt);
      }
      if (patch.gemini) {
        this.settings.gemini = Object.assign({}, this.settings.gemini, patch.gemini);
      }
      saveStorage(CFG.STORAGE_KEYS.SETTINGS, this.settings);
      emit('settings', this.settings);
    },

    setConnection: function (patch) {
      this.connection = Object.assign({}, this.connection, patch);
      emit('connection', this.connection);
    },

    persistPlants: function () {
      var ok = saveStorage(CFG.STORAGE_KEYS.PLANTS, this.plants);
      if (!ok) {
        // Trim older thumbnails if localStorage quota is tight
        for (var i = 0; i < this.plants.length; i++) {
          if (Array.isArray(this.plants[i].scans) && this.plants[i].scans.length > 2) {
            this.plants[i].scans = this.plants[i].scans.slice(0, 2);
          }
        }
        saveStorage(CFG.STORAGE_KEYS.PLANTS, this.plants);
      }
      emit('plants', this.plants);
    },

    addPlant: function (data) {
      if (this.plants.length >= CFG.MAX_PLANTS) {
        return { error: 'Достигнут лимит: максимум ' + CFG.MAX_PLANTS + ' растений в теплице.' };
      }
      var id = 'plant-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
      var plant = {
        id: id,
        name: (data.name || 'Новое растение').trim(),
        species: (data.species || '').trim(),
        notes: (data.notes || '').trim(),
        healthScore: null,
        status: 'unknown',
        lastScanAt: null,
        lastDiagnosis: 'Фотография ещё не загружена. Перейдите во вкладку «ИИ-диагностика», чтобы оценить состояние.',
        lastSymptoms: [],
        lastRecommendations: [],
        lastThumb: null,
        scans: []
      };
      this.plants.push(plant);
      this.selectedPlantId = plant.id;
      this.addLog('ok', 'В базу теплицы добавлено растение: ' + plant.name);
      this.persistPlants();
      if (GH.Supabase && GH.Supabase.isReady()) {
        GH.Supabase.savePlant(plant);
      }
      return { plant: plant };
    },

    updatePlant: function (id, patch) {
      var plant = this.plants.find(function (p) {
        return p.id === id;
      });
      if (!plant) return null;
      Object.assign(plant, patch);
      this.persistPlants();
      if (GH.Supabase && GH.Supabase.isReady()) {
        GH.Supabase.savePlant(plant);
      }
      return plant;
    },

    recordPlantScan: function (id, scanResult, thumbDataUrl) {
      var plant = this.plants.find(function (p) {
        return p.id === id;
      });
      if (!plant) return null;

      var score = Math.max(0, Math.min(100, Math.round(Number(scanResult.healthScore) || 0)));
      var status = scanResult.status && CFG.STATUS_META[scanResult.status]
        ? scanResult.status
        : scoreToStatus(score);

      var scanEntry = {
        id: 'scan-' + Date.now(),
        ts: Date.now(),
        healthScore: score,
        status: status,
        speciesGuess: scanResult.speciesGuess || '',
        summary: scanResult.summary || '',
        diagnosis: scanResult.diagnosis || '',
        symptoms: Array.isArray(scanResult.symptoms) ? scanResult.symptoms : [],
        recommendations: Array.isArray(scanResult.recommendations) ? scanResult.recommendations : [],
        engine: scanResult.engine || 'gemini',
        thumb: thumbDataUrl || null
      };

      plant.healthScore = score;
      plant.status = status;
      plant.lastScanAt = scanEntry.ts;
      plant.lastDiagnosis = scanEntry.diagnosis || scanEntry.summary;
      plant.lastSymptoms = scanEntry.symptoms;
      plant.lastRecommendations = scanEntry.recommendations;
      if (thumbDataUrl) {
        plant.lastThumb = thumbDataUrl;
      }
      if (!plant.species && scanResult.speciesGuess) {
        plant.species = scanResult.speciesGuess;
      }
      plant.scans = Array.isArray(plant.scans) ? plant.scans : [];
      plant.scans.unshift(scanEntry);
      if (plant.scans.length > 5) {
        plant.scans.length = 5;
      }

      this.addLog(
        status === 'healthy' ? 'ok' : status === 'attention' ? 'warn' : 'alert',
        'ИИ-диагностика «' + plant.name + '»: ' + score + '% (' + CFG.STATUS_META[status].label + ')'
      );
      this.persistPlants();
      if (GH.Supabase && GH.Supabase.isReady()) {
        GH.Supabase.savePlantScan(plant, scanEntry);
      }
      return plant;
    },

    deletePlant: function (id) {
      var idx = this.plants.findIndex(function (p) {
        return p.id === id;
      });
      if (idx === -1) return false;
      var removed = this.plants.splice(idx, 1)[0];
      if (this.selectedPlantId === id) {
        this.selectedPlantId = this.plants[0] ? this.plants[0].id : '';
      }
      this.addLog('warn', 'Растение удалено из базы: ' + removed.name);
      this.persistPlants();
      if (GH.Supabase && GH.Supabase.isReady()) {
        GH.Supabase.deletePlant(id);
      }
      return true;
    },

    hydrateFromRemote: function (data) {
      if (!data || typeof data !== 'object') return;

      if (Array.isArray(data.plants) && data.plants.length > 0) {
        this.plants = data.plants.slice(0, CFG.MAX_PLANTS);
        if (!this.plants.some(function (p) { return p.id === GH.State.selectedPlantId; })) {
          this.selectedPlantId = this.plants[0] ? this.plants[0].id : '';
        }
        saveStorage(CFG.STORAGE_KEYS.PLANTS, this.plants);
        emit('plants', this.plants);
      }

      if (data.config && typeof data.config === 'object') {
        if (data.config.mode === 'manual' || data.config.mode === 'auto') {
          this.mode = data.config.mode;
          saveStorage(CFG.STORAGE_KEYS.MODE, this.mode);
          emit('mode', this.mode);
        }
        if (data.config.actuators && typeof data.config.actuators === 'object') {
          this.actuators = Object.assign({}, this.actuators, data.config.actuators);
          saveStorage(CFG.STORAGE_KEYS.ACTUATORS, this.actuators);
          emit('actuators', this.actuators);
        }
        if (data.config.thresholds && typeof data.config.thresholds === 'object') {
          this.thresholds = Object.assign({}, CFG.DEFAULT_THRESHOLDS, data.config.thresholds);
          saveStorage(CFG.STORAGE_KEYS.THRESHOLDS, this.thresholds);
          emit('thresholds', this.thresholds);
        }
      }

      if (Array.isArray(data.history) && data.history.length > 0) {
        this.history = data.history.slice(-CFG.HISTORY_LIMIT);
        saveStorage(CFG.STORAGE_KEYS.HISTORY, this.history);
        var latest = this.history[this.history.length - 1];
        if (latest) {
          this.telemetry = {
            airTemp: latest.airTemp,
            airHumidity: latest.airHumidity,
            soilMoisture: latest.soilMoisture,
            waterLevel: latest.waterLevel,
            lightLevel: latest.lightLevel,
            lastUpdated: latest.ts || Date.now()
          };
          emit('telemetry', this.telemetry);
        }
        emit('historyCleared', this.history);
      }

      if (Array.isArray(data.logs) && data.logs.length > 0) {
        this.logs = data.logs.slice(0, CFG.LOG_LIMIT);
        emit('logs', this.logs);
      }
    }
  };
})();
