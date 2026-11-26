(function () {
  'use strict';

  var GH = (window.GH = window.GH || {});
  var CFG = GH.CONFIG;

  var client = null;
  var lastTelemetrySyncAt = 0;
  var isHydrating = false;

  function toIso(ts) {
    if (!ts) return null;
    try {
      return new Date(ts).toISOString();
    } catch (e) {
      return null;
    }
  }

  function toMs(iso) {
    if (!iso) return null;
    var parsed = Date.parse(iso);
    return Number.isNaN(parsed) ? null : parsed;
  }

  function plantToRow(plant) {
    return {
      id: plant.id,
      name: plant.name || 'Новое растение',
      species: plant.species || '',
      notes: plant.notes || '',
      health_score:
        plant.healthScore === null || plant.healthScore === undefined
          ? null
          : Math.round(Number(plant.healthScore)),
      status: plant.status || 'unknown',
      last_scan_at: toIso(plant.lastScanAt),
      last_diagnosis: plant.lastDiagnosis || '',
      last_symptoms: Array.isArray(plant.lastSymptoms) ? plant.lastSymptoms : [],
      last_recommendations: Array.isArray(plant.lastRecommendations)
        ? plant.lastRecommendations
        : [],
      last_thumb: plant.lastThumb || null,
      updated_at: new Date().toISOString()
    };
  }

  function rowToPlant(row, scans) {
    return {
      id: row.id,
      name: row.name,
      species: row.species || '',
      notes: row.notes || '',
      healthScore:
        row.health_score === null || row.health_score === undefined
          ? null
          : Number(row.health_score),
      status: row.status || 'unknown',
      lastScanAt: toMs(row.last_scan_at),
      lastDiagnosis: row.last_diagnosis || '',
      lastSymptoms: Array.isArray(row.last_symptoms) ? row.last_symptoms : [],
      lastRecommendations: Array.isArray(row.last_recommendations)
        ? row.last_recommendations
        : [],
      lastThumb: row.last_thumb || null,
      scans: scans || []
    };
  }

  function rowToScan(row) {
    return {
      id: row.id,
      ts: toMs(row.scanned_at) || Date.now(),
      healthScore: Number(row.health_score) || 0,
      status: row.status || 'unknown',
      speciesGuess: row.species_guess || '',
      summary: row.summary || '',
      diagnosis: row.diagnosis || '',
      symptoms: Array.isArray(row.symptoms) ? row.symptoms : [],
      recommendations: Array.isArray(row.recommendations) ? row.recommendations : [],
      engine: row.engine || 'gemini',
      thumb: row.thumb || null
    };
  }

  function scanToRow(plantId, scanEntry) {
    return {
      id: scanEntry.id,
      plant_id: plantId,
      scanned_at: toIso(scanEntry.ts) || new Date().toISOString(),
      health_score: Math.max(0, Math.min(100, Math.round(Number(scanEntry.healthScore) || 0))),
      status: scanEntry.status || 'unknown',
      species_guess: scanEntry.speciesGuess || '',
      summary: scanEntry.summary || '',
      diagnosis: scanEntry.diagnosis || '',
      symptoms: Array.isArray(scanEntry.symptoms) ? scanEntry.symptoms : [],
      recommendations: Array.isArray(scanEntry.recommendations)
        ? scanEntry.recommendations
        : [],
      engine: scanEntry.engine || 'gemini',
      thumb: scanEntry.thumb || null
    };
  }

  function setStatus(status, detail) {
    GH.Supabase.status = status;
    GH.Supabase.detail = detail || '';
    var badge = document.getElementById('cfg-supabase-status');
    if (badge) {
      if (status === 'connected') {
        badge.textContent = 'Подключено (Supabase)';
        badge.className = 'mono-tag status-healthy';
      } else if (status === 'connecting') {
        badge.textContent = 'Подключение...';
        badge.className = 'mono-tag';
      } else {
        badge.textContent = 'Офлайн / ошибка: ' + (detail || 'нет связи');
        badge.className = 'mono-tag status-critical';
      }
    }
  }

  GH.Supabase = {
    status: 'idle',
    detail: '',

    isReady: function () {
      return Boolean(client) && !isHydrating;
    },

    init: async function () {
      var sbCfg = CFG.SUPABASE;
      if (!sbCfg || !sbCfg.url || !sbCfg.publishableKey) {
        setStatus('error', 'Не заданы параметры Supabase');
        return false;
      }
      if (!window.supabase || typeof window.supabase.createClient !== 'function') {
        setStatus('error', 'SDK Supabase не загружен');
        return false;
      }

      setStatus('connecting', '');
      try {
        client = window.supabase.createClient(sbCfg.url, sbCfg.publishableKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false
          }
        });

        var [plantsRes, scansRes, cfgRes, telemetryRes, logsRes] = await Promise.all([
          client
            .from('plants')
            .select('*')
            .order('created_at', { ascending: true })
            .limit(CFG.MAX_PLANTS),
          client
            .from('plant_scans')
            .select('*')
            .order('scanned_at', { ascending: false })
            .limit(25),
          client
            .from('greenhouse_config')
            .select('*')
            .eq('id', 'default')
            .maybeSingle(),
          client
            .from('telemetry_logs')
            .select('*')
            .order('recorded_at', { ascending: false })
            .limit(CFG.HISTORY_LIMIT),
          client
            .from('system_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(CFG.LOG_LIMIT)
        ]);

        if (plantsRes.error) throw plantsRes.error;
        if (scansRes.error) throw scansRes.error;
        if (cfgRes.error) throw cfgRes.error;
        if (telemetryRes.error) throw telemetryRes.error;
        if (logsRes.error) throw logsRes.error;

        var scansByPlant = {};
        (scansRes.data || []).forEach(function (s) {
          if (!scansByPlant[s.plant_id]) scansByPlant[s.plant_id] = [];
          if (scansByPlant[s.plant_id].length < 5) {
            scansByPlant[s.plant_id].push(rowToScan(s));
          }
        });

        var plants = (plantsRes.data || []).map(function (p) {
          return rowToPlant(p, scansByPlant[p.id] || []);
        });

        var history = (telemetryRes.data || [])
          .slice()
          .reverse()
          .map(function (t) {
            return {
              ts: toMs(t.recorded_at) || Date.now(),
              airTemp: Number(t.air_temp),
              airHumidity: Number(t.air_humidity),
              soilMoisture: Number(t.soil_moisture),
              waterLevel: Number(t.water_level),
              lightLevel: Number(t.light_level)
            };
          });

        var logs = (logsRes.data || []).map(function (l) {
          return {
            ts: toMs(l.created_at) || Date.now(),
            level: l.level || 'info',
            text: l.message || ''
          };
        });

        isHydrating = true;
        try {
          GH.State.hydrateFromRemote({
            plants: plants.length > 0 ? plants : null,
            config: cfgRes.data || null,
            history: history.length > 0 ? history : null,
            logs: logs.length > 0 ? logs : null
          });
        } finally {
          isHydrating = false;
        }

        setStatus('connected', 'OK');
        GH.State.addLog('ok', 'База данных Supabase (PostgreSQL) подключена');
        return true;
      } catch (err) {
        console.error('Supabase init error:', err);
        setStatus('error', err && err.message ? err.message : 'Ошибка подключения');
        GH.State.addLog(
          'warn',
          'Supabase недоступен, используется локальный кэш: ' +
            (err && err.message ? err.message : 'ошибка сети')
        );
        return false;
      }
    },

    savePlant: async function (plant) {
      if (!this.isReady() || !plant) return;
      try {
        var res = await client.from('plants').upsert(plantToRow(plant), { onConflict: 'id' });
        if (res.error) throw res.error;
      } catch (err) {
        console.error('Supabase savePlant error:', err);
      }
    },

    deletePlant: async function (plantId) {
      if (!this.isReady() || !plantId) return;
      try {
        var res = await client.from('plants').delete().eq('id', plantId);
        if (res.error) throw res.error;
      } catch (err) {
        console.error('Supabase deletePlant error:', err);
      }
    },

    savePlantScan: async function (plant, scanEntry) {
      if (!this.isReady() || !plant || !scanEntry) return;
      try {
        var [plantRes, scanRes] = await Promise.all([
          client.from('plants').upsert(plantToRow(plant), { onConflict: 'id' }),
          client.from('plant_scans').upsert(scanToRow(plant.id, scanEntry), { onConflict: 'id' })
        ]);
        if (plantRes.error) throw plantRes.error;
        if (scanRes.error) throw scanRes.error;
      } catch (err) {
        console.error('Supabase savePlantScan error:', err);
      }
    },

    saveConfig: async function (state) {
      if (!this.isReady() || !state) return;
      try {
        var res = await client.from('greenhouse_config').upsert(
          {
            id: 'default',
            mode: state.mode === 'manual' ? 'manual' : 'auto',
            actuators: state.actuators,
            thresholds: state.thresholds,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'id' }
        );
        if (res.error) throw res.error;
      } catch (err) {
        console.error('Supabase saveConfig error:', err);
      }
    },

    pushTelemetry: async function (telemetry, source) {
      if (!this.isReady() || !telemetry) return;
      var now = Date.now();
      var interval = (CFG.SUPABASE && CFG.SUPABASE.telemetrySyncIntervalMs) || 10000;
      if (now - lastTelemetrySyncAt < interval) return;
      lastTelemetrySyncAt = now;

      try {
        var res = await client.from('telemetry_logs').insert({
          recorded_at: toIso(telemetry.lastUpdated || now),
          source: source === 'mqtt' ? 'mqtt' : 'sim',
          air_temp: Number(telemetry.airTemp),
          air_humidity: Math.round(Number(telemetry.airHumidity)),
          soil_moisture: Math.round(Number(telemetry.soilMoisture)),
          water_level: Math.round(Number(telemetry.waterLevel)),
          light_level: Math.round(Number(telemetry.lightLevel))
        });
        if (res.error) throw res.error;
      } catch (err) {
        console.error('Supabase pushTelemetry error:', err);
      }
    },

    clearTelemetry: async function () {
      if (!this.isReady()) return;
      try {
        var res = await client.from('telemetry_logs').delete().gte('id', 0);
        if (res.error) throw res.error;
      } catch (err) {
        console.error('Supabase clearTelemetry error:', err);
      }
    },

    pushLog: async function (entry) {
      if (!this.isReady() || !entry) return;
      try {
        var res = await client.from('system_logs').insert({
          created_at: toIso(entry.ts) || new Date().toISOString(),
          level: entry.level || 'info',
          message: entry.text || ''
        });
        if (res.error) throw res.error;
      } catch (err) {
        console.error('Supabase pushLog error:', err);
      }
    },

    clearLogs: async function () {
      if (!this.isReady()) return;
      try {
        var res = await client.from('system_logs').delete().gte('id', 0);
        if (res.error) throw res.error;
      } catch (err) {
        console.error('Supabase clearLogs error:', err);
      }
    }
  };
})();
