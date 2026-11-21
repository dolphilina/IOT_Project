(function () {
  'use strict';

  var GH = (window.GH = window.GH || {});
  var CFG = GH.CONFIG;

  var simTimer = null;
  var lowWaterAlertActive = false;
  var simPhase = 0;

  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  /**
   * Hysteresis-based automatic greenhouse control with dry-run water interlock.
   */
  function evaluateAutoControl(telemetry, currentActuators, thresholds) {
    var next = Object.assign({}, currentActuators);
    var lowWater = telemetry.waterLevel <= thresholds.waterMinSafe;

    // Safety interlock alert tracking (log once per state transition)
    if (lowWater && !lowWaterAlertActive) {
      lowWaterAlertActive = true;
      GH.State.addLog(
        'alert',
        'БЛОКИРОВКА: Уровень воды (' +
          telemetry.waterLevel +
          '%) ≤ порога (' +
          thresholds.waterMinSafe +
          '%). Насос и увлажнитель отключены.'
      );
    } else if (!lowWater && lowWaterAlertActive) {
      lowWaterAlertActive = false;
      GH.State.addLog('ok', 'Уровень воды в баке восстановлен (' + telemetry.waterLevel + '%). Блокировка снята.');
    }

    // 1. Pump (GPIO 18)
    if (lowWater) {
      next.pump = false;
    } else if (telemetry.soilMoisture < thresholds.soilMin) {
      next.pump = true;
    } else if (telemetry.soilMoisture >= thresholds.soilMax) {
      next.pump = false;
    }

    // 2. Heater (GPIO 19)
    if (telemetry.airTemp < thresholds.tempMin) {
      next.heater = true;
    } else if (telemetry.airTemp >= thresholds.tempMin + 2) {
      next.heater = false;
    }

    // 3. Fan (GPIO 26)
    if (telemetry.airTemp > thresholds.tempMax || telemetry.airHumidity > thresholds.humMax) {
      next.fan = true;
    } else if (
      telemetry.airTemp <= thresholds.tempMax - 2 &&
      telemetry.airHumidity <= thresholds.humMax - 5
    ) {
      next.fan = false;
    }

    // Prevent fighting between heater and fan
    if (next.heater && telemetry.airTemp < thresholds.tempMin + 1) {
      next.fan = false;
    }

    // 4. Humidifier (GPIO 33)
    if (lowWater) {
      next.humidifier = false;
    } else if (telemetry.airHumidity < thresholds.humMin) {
      next.humidifier = true;
    } else if (telemetry.airHumidity >= thresholds.humMin + 8) {
      next.humidifier = false;
    }

    // 5. Grow LED (GPIO 25)
    if (telemetry.lightLevel < thresholds.lightMin) {
      next.light = true;
    } else if (telemetry.lightLevel >= thresholds.lightMin + 15) {
      next.light = false;
    }

    return next;
  }

  function applyAutoIfEnabled() {
    if (GH.State.mode !== 'auto') {
      // Even in manual mode, enforce hard water safety interlock on pump/humidifier
      var t = GH.State.telemetry;
      var th = GH.State.thresholds;
      if (t.waterLevel <= th.waterMinSafe && (GH.State.actuators.pump || GH.State.actuators.humidifier)) {
        GH.State.setAllActuators(
          {
            pump: false,
            humidifier: false
          },
          true
        );
        GH.State.addLog('alert', 'Аварийная защита: насос/увлажнитель остановлены из-за низкого уровня воды.');
        if (GH.State.settings.source === 'mqtt' && GH.Mqtt) {
          GH.Mqtt.publishControl();
        }
      }
      return false;
    }

    var next = evaluateAutoControl(
      GH.State.telemetry,
      GH.State.actuators,
      GH.State.thresholds
    );
    var changed = GH.State.setAllActuators(next, false);
    if (changed && GH.State.settings.source === 'mqtt' && GH.Mqtt) {
      GH.Mqtt.publishControl();
    }
    return changed;
  }

  function simTick() {
    if (GH.State.settings.source !== 'sim') return;

    simPhase += 0.18;
    var cur = GH.State.telemetry;
    var act = GH.State.actuators;

    var ambientTemp = 22.8 + Math.sin(simPhase * 0.25) * 1.4;
    var ambientLight = 58 + Math.sin(simPhase * 0.15) * 26;

    var nextTemp = cur.airTemp + (ambientTemp - cur.airTemp) * 0.05 + (Math.random() - 0.5) * 0.22;
    var nextHum = cur.airHumidity + (58 - cur.airHumidity) * 0.04 + (Math.random() - 0.5) * 0.8;
    var nextSoil = cur.soilMoisture - 0.35 + (Math.random() - 0.5) * 0.25;
    var nextWater = cur.waterLevel;
    var nextLight = cur.lightLevel + (ambientLight - cur.lightLevel) * 0.12 + (Math.random() - 0.5) * 1.2;

    if (act.heater) {
      nextTemp += 0.45;
      nextHum -= 0.4;
    }
    if (act.fan) {
      nextTemp -= 0.4;
      nextHum -= 1.4;
    }
    if (act.pump && cur.waterLevel > 0) {
      nextSoil += 3.5;
      nextWater -= 0.6;
    }
    if (act.humidifier && cur.waterLevel > 0) {
      nextHum += 2.8;
      nextWater -= 0.2;
    }
    if (act.light) {
      nextLight += (86 - nextLight) * 0.25;
    }

    GH.State.updateTelemetry(
      {
        airTemp: clamp(nextTemp, 5, 48),
        airHumidity: clamp(nextHum, 15, 98),
        soilMoisture: clamp(nextSoil, 5, 95),
        waterLevel: clamp(nextWater, 0, 100),
        lightLevel: clamp(nextLight, 2, 100)
      },
      true
    );

    applyAutoIfEnabled();
  }

  function startSimulator() {
    if (simTimer) clearInterval(simTimer);
    simTimer = setInterval(simTick, CFG.SIM_TICK_MS);
    applyAutoIfEnabled();
  }

  function stopSimulator() {
    if (simTimer) {
      clearInterval(simTimer);
      simTimer = null;
    }
  }

  function refillWaterTank() {
    var cur = GH.State.telemetry;
    GH.State.updateTelemetry(
      {
        airTemp: cur.airTemp,
        airHumidity: cur.airHumidity,
        soilMoisture: cur.soilMoisture,
        waterLevel: 100,
        lightLevel: cur.lightLevel
      },
      true
    );
    GH.State.addLog('ok', 'Бак для воды пополнен до 100% (симулятор)');
    applyAutoIfEnabled();
  }

  GH.Controller = {
    evaluateAutoControl: evaluateAutoControl,
    applyAutoIfEnabled: applyAutoIfEnabled
  };

  GH.Simulator = {
    start: startSimulator,
    stop: stopSimulator,
    tick: simTick,
    refillWaterTank: refillWaterTank
  };
})();
