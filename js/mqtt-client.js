(function () {
  'use strict';

  var GH = (window.GH = window.GH || {});

  var client = null;
  var currentPrefix = 'dolphilina/iot_greenhouse';

  function cleanPrefix(prefix) {
    return String(prefix || 'dolphilina/iot_greenhouse')
      .trim()
      .replace(/^\/+|\/+$/g, '');
  }

  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  function pickNumber(obj, keys, fallback) {
    for (var i = 0; i < keys.length; i++) {
      var val = obj[keys[i]];
      if (val !== undefined && val !== null && val !== '' && !Number.isNaN(Number(val))) {
        return Number(val);
      }
    }
    return fallback;
  }

  function handleTelemetryMessage(rawText) {
    var data;
    try {
      data = JSON.parse(rawText);
    } catch (e) {
      return;
    }
    if (!data || typeof data !== 'object') return;

    var cur = GH.State.telemetry;
    var next = {
      airTemp: clamp(pickNumber(data, ['airTemp', 'temp', 'temperature', 't'], cur.airTemp), -10, 60),
      airHumidity: clamp(pickNumber(data, ['airHumidity', 'humidity', 'hum', 'h'], cur.airHumidity), 0, 100),
      soilMoisture: clamp(pickNumber(data, ['soilMoisture', 'soil', 'moisture'], cur.soilMoisture), 0, 100),
      waterLevel: clamp(pickNumber(data, ['waterLevel', 'water', 'tank'], cur.waterLevel), 0, 100),
      lightLevel: clamp(pickNumber(data, ['lightLevel', 'light', 'ldr', 'lux'], cur.lightLevel), 0, 100)
    };

    GH.State.setConnection({ espOnline: true });
    GH.State.updateTelemetry(next, true);

    if (GH.State.mode === 'auto' && GH.Controller) {
      GH.Controller.applyAutoIfEnabled();
    } else if (data.actuators && typeof data.actuators === 'object') {
      GH.State.setAllActuators(data.actuators, true);
    }
  }

  function handleStatusMessage(rawText) {
    var txt = String(rawText || '').trim();
    if (!txt) return;
    if (txt.charAt(0) === '{') {
      try {
        var obj = JSON.parse(txt);
        var online = obj.online !== undefined ? Boolean(obj.online) : obj.status === 'online';
        GH.State.setConnection({ espOnline: online });
        return;
      } catch (e) {
        // fallback below
      }
    }
    GH.State.setConnection({ espOnline: txt.toLowerCase() === 'online' });
  }

  function disconnect(silent) {
    if (client) {
      try {
        client.end(true);
      } catch (e) {
        // ignore
      }
      client = null;
    }
    if (!silent) {
      GH.State.setConnection({
        status: GH.State.settings.source === 'sim' ? 'sim' : 'disconnected',
        espOnline: false,
        message:
          GH.State.settings.source === 'sim'
            ? 'Локальный симулятор теплицы'
            : 'Отключено от MQTT-брокера'
      });
    }
  }

  function connect(mqttConfig) {
    disconnect(true);

    if (typeof window.mqtt === 'undefined' || !window.mqtt.connect) {
      GH.State.setConnection({
        status: 'error',
        espOnline: false,
        message: 'Библиотека MQTT.js не загружена (проверьте интернет)'
      });
      GH.State.addLog('alert', 'Ошибка: не удалось загрузить клиент MQTT.js');
      return;
    }

    var cfg = mqttConfig || GH.State.settings.mqtt;
    var url = String(cfg.brokerUrl || '').trim();
    currentPrefix = cleanPrefix(cfg.topicPrefix);

    if (!url) {
      GH.State.setConnection({
        status: 'error',
        espOnline: false,
        message: 'Не указан WSS URL брокера MQTT'
      });
      return;
    }

    GH.State.setConnection({
      status: 'connecting',
      espOnline: false,
      message: 'Подключение к ' + url + '...'
    });

    var options = {
      clientId: 'gh_scada_' + Math.random().toString(16).slice(2, 10),
      clean: true,
      connectTimeout: 8000,
      reconnectPeriod: 5000
    };
    if (cfg.username) options.username = cfg.username;
    if (cfg.password) options.password = cfg.password;

    try {
      client = window.mqtt.connect(url, options);
    } catch (err) {
      GH.State.setConnection({
        status: 'error',
        espOnline: false,
        message: 'Ошибка подключения: ' + err.message
      });
      GH.State.addLog('alert', 'MQTT ошибка: ' + err.message);
      return;
    }

    client.on('connect', function () {
      GH.State.setConnection({
        status: 'connected',
        message: 'Подключено · топик ' + currentPrefix + '/#'
      });
      GH.State.addLog('ok', 'MQTT подключён (' + currentPrefix + ')');
      client.subscribe([currentPrefix + '/telemetry', currentPrefix + '/status'], function (err) {
        if (err) {
          GH.State.addLog('alert', 'Ошибка подписки MQTT: ' + err.message);
        }
      });
      publishControl();
    });

    client.on('message', function (topic, payload) {
      var text = payload ? payload.toString() : '';
      if (topic === currentPrefix + '/telemetry') {
        handleTelemetryMessage(text);
      } else if (topic === currentPrefix + '/status') {
        handleStatusMessage(text);
      }
    });

    client.on('reconnect', function () {
      GH.State.setConnection({
        status: 'connecting',
        message: 'Переподключение к MQTT...'
      });
    });

    client.on('error', function (err) {
      GH.State.setConnection({
        status: 'error',
        espOnline: false,
        message: 'Ошибка MQTT: ' + (err && err.message ? err.message : 'сбой соединения')
      });
    });

    client.on('close', function () {
      if (GH.State.settings.source === 'mqtt' && GH.State.connection.status !== 'error') {
        GH.State.setConnection({
          status: 'disconnected',
          espOnline: false,
          message: 'Соединение MQTT закрыто'
        });
      }
    });
  }

  function publishControl() {
    if (!client || !client.connected || GH.State.settings.source !== 'mqtt') {
      return false;
    }
    var payload = JSON.stringify({
      mode: GH.State.mode,
      actuators: GH.State.actuators,
      thresholds: GH.State.thresholds,
      ts: Date.now()
    });
    try {
      client.publish(currentPrefix + '/control', payload, { retain: true, qos: 0 });
      return true;
    } catch (e) {
      return false;
    }
  }

  GH.Mqtt = {
    connect: connect,
    disconnect: disconnect,
    publishControl: publishControl
  };
})();
