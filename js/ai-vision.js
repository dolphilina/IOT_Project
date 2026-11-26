(function () {
  'use strict';

  var GH = (window.GH = window.GH || {});

  function loadImageFromFile(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function (ev) {
        var img = new Image();
        img.onload = function () {
          resolve({ img: img, dataUrl: ev.target.result });
        };
        img.onerror = function () {
          reject(new Error('Не удалось прочитать изображение'));
        };
        img.src = ev.target.result;
      };
      reader.onerror = function () {
        reject(new Error('Ошибка чтения файла'));
      };
      reader.readAsDataURL(file);
    });
  }

  function resizeToJpeg(img, maxDim, quality) {
    var w = img.naturalWidth || img.width;
    var h = img.naturalHeight || img.height;
    var scale = Math.min(1, maxDim / Math.max(w, h));
    var outW = Math.max(1, Math.round(w * scale));
    var outH = Math.max(1, Math.round(h * scale));

    var canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    var ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, outW, outH);
    var dataUrl = canvas.toDataURL('image/jpeg', quality);
    var base64 = dataUrl.split(',')[1] || '';
    return { dataUrl: dataUrl, base64: base64 };
  }

  function prepareImage(file) {
    return loadImageFromFile(file).then(function (loaded) {
      var apiSized = resizeToJpeg(loaded.img, 1024, 0.85);
      var thumbSized = resizeToJpeg(loaded.img, 160, 0.65);
      return {
        img: loaded.img,
        previewUrl: apiSized.dataUrl,
        base64Jpeg: apiSized.base64,
        thumbUrl: thumbSized.dataUrl
      };
    });
  }

  function rgbToHsv(r, g, b) {
    var rn = r / 255;
    var gn = g / 255;
    var bn = b / 255;
    var max = Math.max(rn, gn, bn);
    var min = Math.min(rn, gn, bn);
    var d = max - min;
    var h = 0;
    var s = max === 0 ? 0 : d / max;
    var v = max;

    if (d !== 0) {
      switch (max) {
        case rn:
          h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
          break;
        case gn:
          h = ((bn - rn) / d + 2) / 6;
          break;
        case bn:
          h = ((rn - gn) / d + 4) / 6;
          break;
      }
    }
    return { h: h * 360, s: s, v: v };
  }

  /**
   * Local heuristic demo analyzer based on central leaf color HSV distribution + current greenhouse telemetry.
   */
  function analyzeLocallyDemo(img, plantName, telemetry) {
    var size = 128;
    var canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    var ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, size, size);

    // Central 70% crop
    var start = Math.floor(size * 0.15);
    var len = Math.floor(size * 0.7);
    var pixels = ctx.getImageData(start, start, len, len).data;

    var totalPlantPx = 0;
    var healthyGreenPx = 0;
    var yellowChlorosisPx = 0;
    var brownNecrosisPx = 0;
    var sampled = 0;

    for (var i = 0; i < pixels.length; i += 4) {
      sampled++;
      var hsv = rgbToHsv(pixels[i], pixels[i + 1], pixels[i + 2]);
      if (hsv.s < 0.14 || hsv.v < 0.12) continue;

      if (hsv.h >= 68 && hsv.h <= 165 && hsv.v > 0.2) {
        healthyGreenPx++;
        totalPlantPx++;
      } else if (hsv.h >= 36 && hsv.h < 68 && hsv.v > 0.28) {
        yellowChlorosisPx++;
        totalPlantPx++;
      } else if (hsv.h >= 8 && hsv.h < 36 && hsv.s > 0.22 && hsv.v < 0.65) {
        brownNecrosisPx++;
        totalPlantPx++;
      }
    }

    var greenRatio = totalPlantPx > 0 ? healthyGreenPx / totalPlantPx : 0;
    var yellowRatio = totalPlantPx > 0 ? yellowChlorosisPx / totalPlantPx : 0;
    var brownRatio = totalPlantPx > 0 ? brownNecrosisPx / totalPlantPx : 0;
    var plantCoverage = totalPlantPx / Math.max(1, sampled);

    var score;
    var status;
    var summary;
    var diagnosis;
    var symptoms = [];

    if (plantCoverage < 0.06) {
      score = 62;
      status = 'attention';
      summary = 'Листва занимает малую долю кадра (локальный демо-анализ)';
      diagnosis =
        'На фото слабо выражена зелёная листовая масса. Для точного распознавания болезни, вредителей и вида растения введите бесплатный ключ Google Gemini Vision API в настройках.';
      symptoms = ['Малая площадь листвы в центре кадра', 'Демо-режим (цветовой анализ)'];
    } else {
      score = Math.round(
        Math.max(
          15,
          Math.min(96, greenRatio * 96 - yellowRatio * 48 - brownRatio * 75 + 8)
        )
      );
      if (score >= 80) {
        status = 'healthy';
        summary = 'Растение выглядит здоровым · высокий уровень зелёного хлорофилла';
        diagnosis =
          'Локальный анализ цветовых зон показал доминирование здорового зелёного пигмента (' +
          Math.round(greenRatio * 100) +
          '% растительных пикселей) без выраженных некротических очагов.';
        symptoms = ['Равномерный зелёный окрас', 'Низкая доля жёлтых/сухих участков'];
      } else if (score >= 55) {
        status = 'attention';
        summary = 'Обнаружены признаки стресса или начального хлороза';
        diagnosis =
          'В кадре присутствует заметная доля жёлтых или ослабленных оттенков (' +
          Math.round((yellowRatio + brownRatio) * 100) +
          '%). Возможен лёгкий дефицит влаги, питания или перегрев.';
        symptoms = ['Частичное пожелтение листвы', 'Требуется проверка полива и микроэлементов'];
      } else if (score >= 30) {
        status = 'sick';
        summary = 'Выраженное увядание, хлороз или подсыхание листьев';
        diagnosis =
          'Локальный анализ выявил значительную долю жёлто-бурых участков (' +
          Math.round((yellowRatio + brownRatio) * 100) +
          '%). Рекомендуется осмотреть листья на болезни и подключить Gemini Vision для точного диагноза.';
        symptoms = ['Выраженный хлороз/бурые пятна', 'Сниженная доля здоровой листвы'];
      } else {
        status = 'critical';
        summary = 'Критическое состояние листвы · преобладают сухие/бурые тона';
        diagnosis =
          'Высокая доля бурых и сухих участков (' +
          Math.round(brownRatio * 100) +
          '%). Срочно проверьте корневую зону, полив и температурный режим.';
        symptoms = ['Сильное усыхание/некроз', 'Критический дефицит здоровой ткани'];
      }
    }

    var recs = [];
    if (telemetry.soilMoisture < 35) {
      recs.push('Почва суховата (' + telemetry.soilMoisture + '%) — рекомендуется полив или проверка насоса.');
    } else if (telemetry.soilMoisture > 72) {
      recs.push('Почва переувлажнена (' + telemetry.soilMoisture + '%) — снизьте полив во избежание корневой гнили.');
    }
    if (telemetry.airTemp > 28) {
      recs.push('Температура в теплице повышена (' + telemetry.airTemp + ' °C) — включите вентиляцию.');
    } else if (telemetry.airTemp < 19) {
      recs.push('Прохладно (' + telemetry.airTemp + ' °C) — активируйте подогрев.');
    }
    if (telemetry.lightLevel < 35) {
      recs.push('Недостаточная освещённость (' + telemetry.lightLevel + '%) — включите фитолампу.');
    }
    if (!recs.length) {
      recs.push('Текущие параметры микроклимата теплицы благоприятны для «' + plantName + '».');
    }
    recs.push('Для полноценного ИИ-диагноза по болезням добавьте ключ Gemini API в настройках.');

    return {
      isPlant: true,
      speciesGuess: '',
      healthScore: score,
      status: status,
      summary: summary,
      diagnosis: diagnosis,
      symptoms: symptoms,
      recommendations: recs,
      engine: 'local-demo'
    };
  }

  function analyzeWithGemini(base64Jpeg, apiKey, model, plantName, telemetry) {
    var cleanKey = String(apiKey || '').trim();
    var selectedModel = String(model || 'gemini-3.8-flash').trim();
    var endpoint =
      'https://generativelanguage.googleapis.com/v1beta/models/' +
      encodeURIComponent(selectedModel) +
      ':generateContent?key=' +
      encodeURIComponent(cleanKey);

    var prompt =
      'Ты опытный агроном и фитопатолог умной IoT-теплицы. Проанализируй фотографию растения «' +
      plantName +
      '».\n' +
      'Текущие показания датчиков теплицы:\n' +
      '- Температура воздуха: ' + telemetry.airTemp + ' °C\n' +
      '- Влажность воздуха: ' + telemetry.airHumidity + ' %\n' +
      '- Влажность почвы: ' + telemetry.soilMoisture + ' %\n' +
      '- Освещённость: ' + telemetry.lightLevel + ' %\n' +
      '- Уровень воды в баке: ' + telemetry.waterLevel + ' %\n\n' +
      'Верни СТРОГО валидный JSON-объект на русском языке со следующими полями:\n' +
      '{\n' +
      '  "isPlant": true/false,\n' +
      '  "speciesGuess": "название культуры или сорта",\n' +
      '  "healthScore": целое число от 0 до 100,\n' +
      '  "status": одно из значений "healthy" (80-100), "attention" (55-79), "sick" (30-54), "critical" (0-29),\n' +
      '  "summary": "короткий заголовок вывода (до 90 символов)",\n' +
      '  "diagnosis": "подробное описание состояния листьев, стебля и возможных проблем (2-4 предложения)",\n' +
      '  "symptoms": ["симптом 1", "симптом 2"],\n' +
      '  "recommendations": ["конкретная рекомендация 1", "конкретная рекомендация 2"]\n' +
      '}';

    var body = {
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: 'image/jpeg',
                data: base64Jpeg
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.25,
        responseMimeType: 'application/json'
      }
    };

    return fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (res) {
      return res.json().then(function (json) {
        if (!res.ok) {
          var msg = (json && json.error && json.error.message) || ('HTTP ' + res.status);
          if (res.status === 400 || res.status === 401 || res.status === 403) {
            throw new Error('Ошибка авторизации Gemini API (' + res.status + '): проверьте API-ключ в настройках.');
          }
          if (res.status === 429) {
            throw new Error('Превышен лимит запросов Gemini API (429). Подождите немного и попробуйте снова.');
          }
          throw new Error('Ошибка Gemini API: ' + msg);
        }

        var candidate = json.candidates && json.candidates[0];
        var parts = candidate && candidate.content && candidate.content.parts;
        var rawText = parts && parts[0] && parts[0].text ? parts[0].text : '';
        if (!rawText) {
          throw new Error('Gemini вернул пустой ответ. Попробуйте другое фото.');
        }

        var cleaned = rawText.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
        var parsed;
        try {
          parsed = JSON.parse(cleaned);
        } catch (parseErr) {
          throw new Error('Не удалось разобрать JSON-ответ Gemini.');
        }

        var score = Math.max(0, Math.min(100, Math.round(Number(parsed.healthScore) || 0)));
        var status = ['healthy', 'attention', 'sick', 'critical'].indexOf(parsed.status) !== -1
          ? parsed.status
          : GH.State.scoreToStatus(score);

        return {
          isPlant: parsed.isPlant !== false,
          speciesGuess: parsed.speciesGuess || '',
          healthScore: score,
          status: status,
          summary: parsed.summary || 'Диагностика выполнена',
          diagnosis: parsed.diagnosis || parsed.summary || '',
          symptoms: Array.isArray(parsed.symptoms) ? parsed.symptoms : [],
          recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
          engine: 'gemini'
        };
      });
    });
  }

  GH.AIVision = {
    prepareImage: prepareImage,
    analyzeLocallyDemo: analyzeLocallyDemo,
    analyzeWithGemini: analyzeWithGemini
  };
})();
