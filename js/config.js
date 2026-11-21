(function () {
  'use strict';

  window.GH = window.GH || {};

  window.GH.CONFIG = {
    MAX_PLANTS: 5,
    HISTORY_LIMIT: 360,
    LOG_LIMIT: 80,
    SIM_TICK_MS: 2000,

    STORAGE_KEYS: {
      PLANTS: 'gh_scada_v1_plants',
      THRESHOLDS: 'gh_scada_v1_thresholds',
      SETTINGS: 'gh_scada_v1_settings',
      HISTORY: 'gh_scada_v1_history',
      MODE: 'gh_scada_v1_mode',
      ACTUATORS: 'gh_scada_v1_actuators'
    },

    SENSORS: [
      {
        key: 'airTemp',
        label: 'Температура воздуха',
        shortLabel: 'Темп. возд.',
        unit: '°C',
        hardware: 'DHT11',
        gpio: 'GPIO 4',
        min: 0,
        max: 50,
        decimals: 1,
        color: '#f97316',
        colorBg: 'rgba(249, 115, 22, 0.14)',
        thresholdMinKey: 'tempMin',
        thresholdMaxKey: 'tempMax'
      },
      {
        key: 'airHumidity',
        label: 'Влажность воздуха',
        shortLabel: 'Влажн. возд.',
        unit: '%',
        hardware: 'DHT11',
        gpio: 'GPIO 4',
        min: 0,
        max: 100,
        decimals: 0,
        color: '#06b6d4',
        colorBg: 'rgba(6, 182, 212, 0.14)',
        thresholdMinKey: 'humMin',
        thresholdMaxKey: 'humMax'
      },
      {
        key: 'soilMoisture',
        label: 'Влажность почвы',
        shortLabel: 'Почва',
        unit: '%',
        hardware: 'Capacitive Soil v1.2',
        gpio: 'GPIO 34',
        min: 0,
        max: 100,
        decimals: 0,
        color: '#10b981',
        colorBg: 'rgba(16, 185, 129, 0.14)',
        thresholdMinKey: 'soilMin',
        thresholdMaxKey: 'soilMax'
      },
      {
        key: 'waterLevel',
        label: 'Уровень воды в баке',
        shortLabel: 'Уровень воды',
        unit: '%',
        hardware: 'Water Level Sensor',
        gpio: 'GPIO 35 / 27',
        min: 0,
        max: 100,
        decimals: 0,
        color: '#3b82f6',
        colorBg: 'rgba(59, 130, 246, 0.14)',
        thresholdMinKey: 'waterMinSafe',
        thresholdMaxKey: null
      },
      {
        key: 'lightLevel',
        label: 'Освещённость',
        shortLabel: 'Освещение',
        unit: '%',
        hardware: 'Фоторезистор LDR',
        gpio: 'GPIO 32',
        min: 0,
        max: 100,
        decimals: 0,
        color: '#eab308',
        colorBg: 'rgba(234, 179, 8, 0.14)',
        thresholdMinKey: 'lightMin',
        thresholdMaxKey: null
      }
    ],

    ACTUATORS: [
      {
        key: 'pump',
        label: 'Полив (насос)',
        shortLabel: 'Насос',
        hardware: 'MOSFET #1 · Mini Pump',
        gpio: 'GPIO 18',
        description: 'Подача воды в капельный контур'
      },
      {
        key: 'heater',
        label: 'Подогрев',
        shortLabel: 'Нагрев',
        hardware: 'MOSFET #2 · Heating Pad',
        gpio: 'GPIO 19',
        description: 'Резистивный нагревательный коврик'
      },
      {
        key: 'humidifier',
        label: 'Увлажнитель',
        shortLabel: 'Туман',
        hardware: 'MOSFET #3 · Mist Maker',
        gpio: 'GPIO 33',
        description: 'Ультразвуковой генератор тумана'
      },
      {
        key: 'light',
        label: 'Фитолампа',
        shortLabel: 'Свет',
        hardware: 'MOSFET #4 · LED Strip',
        gpio: 'GPIO 25',
        description: 'Светодиодная лента досвечивания'
      },
      {
        key: 'fan',
        label: 'Вентиляция',
        shortLabel: 'Вентил.',
        hardware: 'MOSFET #5 · 5V DC Fan',
        gpio: 'GPIO 26',
        description: 'Приточно-вытяжной обдув 5V'
      }
    ],

    DEFAULT_THRESHOLDS: {
      tempMin: 20,
      tempMax: 27,
      humMin: 50,
      humMax: 78,
      soilMin: 35,
      soilMax: 55,
      lightMin: 40,
      waterMinSafe: 15
    },

    DEFAULT_SETTINGS: {
      theme: 'dark',
      source: 'sim',
      mqtt: {
        brokerUrl: 'wss://broker.emqx.io:8084/mqtt',
        topicPrefix: 'dolphilina/iot_greenhouse',
        username: '',
        password: ''
      },
      gemini: {
        apiKey: '',
        model: 'gemini-2.5-flash'
      }
    },

    MQTT_PRESETS: {
      emqx: 'wss://broker.emqx.io:8084/mqtt',
      hivemq: 'wss://broker.hivemq.com:8884/mqtt'
    },

    STATUS_META: {
      healthy: { label: 'Здорово', badgeClass: 'status-healthy' },
      attention: { label: 'Требует внимания', badgeClass: 'status-attention' },
      sick: { label: 'Болеет', badgeClass: 'status-sick' },
      critical: { label: 'Критично', badgeClass: 'status-critical' },
      unknown: { label: 'Нет фото', badgeClass: 'status-unknown' }
    },

    STARTER_PLANTS: [
      {
        id: 'plant-tomato-1',
        name: 'Томат Черри',
        species: 'Solanum lycopersicum',
        notes: 'Грядка A1 · активное цветение, контрольный куст',
        healthScore: 91,
        status: 'healthy',
        lastScanAt: Date.now() - 1000 * 60 * 48,
        lastDiagnosis: 'Листья насыщенного зелёного цвета, тургор в норме, признаков хлороза или вредителей не обнаружено.',
        lastSymptoms: ['Тургор в норме', 'Насыщенный хлорофилл', 'Без пятен'],
        lastRecommendations: [
          'Поддерживайте влажность почвы в пределах 40–55%.',
          'Обеспечьте не менее 12 часов досветки фитолампой.'
        ],
        lastThumb: null,
        scans: []
      },
      {
        id: 'plant-basil-2',
        name: 'Базилик Зелёный',
        species: 'Ocimum basilicum',
        notes: 'Грядка A2 · чувствителен к пересыханию и сквознякам',
        healthScore: 68,
        status: 'attention',
        lastScanAt: Date.now() - 1000 * 60 * 115,
        lastDiagnosis: 'Заметно лёгкое пожелтение нижних кончиков листьев — возможен начальный дефицит влаги или азота.',
        lastSymptoms: ['Лёгкий краевой хлороз', 'Сниженный тургор нижних листьев'],
        lastRecommendations: [
          'Проверьте стабильность полива и не допускайте падения влажности почвы ниже 35%.',
          'Убедитесь, что температура воздуха не опускается ниже 20 °C.'
        ],
        lastThumb: null,
        scans: []
      },
      {
        id: 'plant-strawberry-3',
        name: 'Клубника Альбион',
        species: 'Fragaria × ananassa',
        notes: 'Грядка B1 · ремонтантный сорт',
        healthScore: 85,
        status: 'healthy',
        lastScanAt: Date.now() - 1000 * 60 * 190,
        lastDiagnosis: 'Розетка сформирована плотно, лист чистый, развитие соответствует норме для фазы роста.',
        lastSymptoms: ['Чистая листовая пластина', 'Равномерный рост'],
        lastRecommendations: [
          'Избегайте переувлажнения воздуха выше 80% во избежание серой гнили.',
          'Регулярно включайте вентиляцию при росте влажности.'
        ],
        lastThumb: null,
        scans: []
      }
    ]
  };
})();
