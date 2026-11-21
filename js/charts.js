(function () {
  'use strict';

  var GH = (window.GH = window.GH || {});
  var CFG = GH.CONFIG;

  var chartInstances = {};
  var initialized = false;

  function formatTimeLabel(ts) {
    var d = new Date(ts);
    return d.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  function getFilteredHistory() {
    var list = GH.State.history || [];
    var range = GH.State.chartRange || 'all';
    if (range === 'all') return list;

    var now = Date.now();
    var windowMs = range === '5m' ? 5 * 60 * 1000 : 30 * 60 * 1000;
    var filtered = list.filter(function (pt) {
      return pt.ts >= now - windowMs;
    });
    return filtered.length > 0 ? filtered : list.slice(-1);
  }

  function getThemeColors() {
    var isLight = document.documentElement.getAttribute('data-theme') === 'light';
    return {
      text: isLight ? '#475569' : '#94a3b8',
      grid: isLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(148, 163, 184, 0.12)',
      tooltipBg: isLight ? '#ffffff' : '#0f172a',
      tooltipText: isLight ? '#0f172a' : '#f1f5f9',
      tooltipBorder: isLight ? '#cbd5e1' : '#334155'
    };
  }

  function updateStatBadges(sensor, values) {
    var curEl = document.getElementById('chart-cur-' + sensor.key);
    var minEl = document.getElementById('chart-min-' + sensor.key);
    var avgEl = document.getElementById('chart-avg-' + sensor.key);
    var maxEl = document.getElementById('chart-max-' + sensor.key);
    if (!values.length) return;

    var min = values[0];
    var max = values[0];
    var sum = 0;
    for (var i = 0; i < values.length; i++) {
      var v = values[i];
      if (v < min) min = v;
      if (v > max) max = v;
      sum += v;
    }
    var avg = sum / values.length;
    var cur = values[values.length - 1];
    var fmt = function (n) {
      return Number(n).toFixed(sensor.decimals) + ' ' + sensor.unit;
    };

    if (curEl) curEl.textContent = fmt(cur);
    if (minEl) minEl.textContent = fmt(min);
    if (avgEl) avgEl.textContent = fmt(avg);
    if (maxEl) maxEl.textContent = fmt(max);
  }

  function initCharts() {
    if (initialized) return;
    if (typeof window.Chart === 'undefined') {
      var fallback = document.getElementById('charts-fallback-banner');
      if (fallback) fallback.hidden = false;
      return;
    }

    var tc = getThemeColors();
    var points = getFilteredHistory();
    var labels = points.map(function (pt) {
      return formatTimeLabel(pt.ts);
    });

    CFG.SENSORS.forEach(function (sensor) {
      var canvas = document.getElementById('chart-' + sensor.key);
      if (!canvas) return;
      var values = points.map(function (pt) {
        return pt[sensor.key];
      });
      updateStatBadges(sensor, values);

      chartInstances[sensor.key] = new window.Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
          labels: labels,
          datasets: [
            {
              label: sensor.label + ' (' + sensor.unit + ')',
              data: values,
              borderColor: sensor.color,
              backgroundColor: sensor.colorBg,
              borderWidth: 2.2,
              fill: true,
              tension: 0.32,
              pointRadius: values.length > 40 ? 0 : 2.5,
              pointHoverRadius: 5
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: tc.tooltipBg,
              titleColor: tc.tooltipText,
              bodyColor: tc.tooltipText,
              borderColor: tc.tooltipBorder,
              borderWidth: 1
            }
          },
          scales: {
            x: {
              grid: { color: tc.grid },
              ticks: {
                color: tc.text,
                maxTicksLimit: 7,
                font: { family: "'JetBrains Mono', monospace", size: 11 }
              }
            },
            y: {
              min: sensor.min,
              max: sensor.max,
              grid: { color: tc.grid },
              ticks: {
                color: tc.text,
                font: { family: "'JetBrains Mono', monospace", size: 11 }
              }
            }
          }
        }
      });
    });

    initialized = true;
  }

  function updateCharts() {
    if (!initialized) {
      initCharts();
    }
    var points = getFilteredHistory();
    var labels = points.map(function (pt) {
      return formatTimeLabel(pt.ts);
    });

    CFG.SENSORS.forEach(function (sensor) {
      var values = points.map(function (pt) {
        return pt[sensor.key];
      });
      updateStatBadges(sensor, values);

      var chart = chartInstances[sensor.key];
      if (!chart) return;
      chart.data.labels = labels;
      chart.data.datasets[0].data = values;
      chart.data.datasets[0].pointRadius = values.length > 40 ? 0 : 2.5;
      chart.update('none');
    });
  }

  function resizeAll() {
    if (!initialized) {
      initCharts();
    }
    Object.keys(chartInstances).forEach(function (key) {
      if (chartInstances[key]) {
        chartInstances[key].resize();
      }
    });
    updateCharts();
  }

  function applyTheme() {
    if (!initialized) return;
    var tc = getThemeColors();
    Object.keys(chartInstances).forEach(function (key) {
      var c = chartInstances[key];
      if (!c) return;
      c.options.scales.x.grid.color = tc.grid;
      c.options.scales.x.ticks.color = tc.text;
      c.options.scales.y.grid.color = tc.grid;
      c.options.scales.y.ticks.color = tc.text;
      c.options.plugins.tooltip.backgroundColor = tc.tooltipBg;
      c.options.plugins.tooltip.titleColor = tc.tooltipText;
      c.options.plugins.tooltip.bodyColor = tc.tooltipText;
      c.options.plugins.tooltip.borderColor = tc.tooltipBorder;
      c.update('none');
    });
  }

  function exportCSV() {
    var history = GH.State.history || [];
    if (!history.length) return;

    var header = [
      'Время (ISO)',
      'Температура воздуха (°C)',
      'Влажность воздуха (%)',
      'Влажность почвы (%)',
      'Уровень воды (%)',
      'Освещённость (%)'
    ].join(';');

    var rows = history.map(function (pt) {
      return [
        new Date(pt.ts).toISOString(),
        pt.airTemp,
        pt.airHumidity,
        pt.soilMoisture,
        pt.waterLevel,
        pt.lightLevel
      ].join(';');
    });

    var csv = '\uFEFF' + [header].concat(rows).join('\r\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    var dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = 'greenhouse_telemetry_' + dateStr + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  GH.Charts = {
    init: initCharts,
    update: updateCharts,
    resizeAll: resizeAll,
    applyTheme: applyTheme,
    exportCSV: exportCSV
  };
})();
