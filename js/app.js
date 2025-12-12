// Основной цикл приложения
async function mainLoop() {
    console.log('mainLoop called, status:', state.status);
    
    if (state.status !== 'running') {
        console.log('Not running, exiting mainLoop');
        return;
    }

    try {
        const symbol = document.getElementById('symbolSelect').value;
        const interval = document.getElementById('timeframeSelect').value;

        console.log('Fetching new data...');
        // Загружаем данные
        const newData = await fetchData(symbol, interval, 10);
        
        if (!newData || newData.length === 0) {
            console.log('No data received, retrying...');
            setTimeout(mainLoop, CONFIG.UPDATE_INTERVAL);
            return;
        }

        console.log(`Received ${newData.length} new candles`);
        
        // Обновляем данные
        for (const candle of newData) {
            const exists = state.priceData.find(d => d.time === candle.time);
            if (!exists) {
                state.priceData.push(candle);
            }
        }

        // Ограничиваем размер
        if (state.priceData.length > 200) {
            state.priceData = state.priceData.slice(-200);
        }

        // Рассчитываем индикаторы
        state.priceData = calculateIndicators(state.priceData);

        // Обновляем индикаторы в таблице
        updateIndicatorsTable();

        // Обновляем список паттернов
        updatePatternsList();

        // Делаем прогноз
        if (state.priceData.length >= CONFIG.LOOKBACK) {
            console.log('Making prediction...');
            const prediction = await makePrediction();

            if (prediction) {
                state.lastPrediction = prediction;

                // Ждем следующую свечу для проверки
                setTimeout(async () => {
                    console.log('Checking prediction result...');
                    const checkData = await fetchData(symbol, interval, 1);
                    if (checkData && checkData.length > 0) {
                        const actualPrice = checkData[0].close;
                        evaluatePrediction(prediction, actualPrice);
                        updateCharts();
                        updateUI();
                        updateLearningMetrics();
                    } else {
                        console.log('No check data available');
                    }
                }, 5000);
            } else {
                console.log('No prediction made');
            }
        } else {
            console.log(`Not enough data for prediction: ${state.priceData.length}/${CONFIG.LOOKBACK}`);
        }

        updateCharts();
        updateUI();
        updateLearningMetrics();

        // Следующий цикл
        console.log('Scheduling next loop...');
        setTimeout(mainLoop, CONFIG.UPDATE_INTERVAL);

    } catch (error) {
        console.error('Ошибка в цикле:', error);
        addLog('Ошибка в основном цикле: ' + error.message, 'warning');
        setTimeout(mainLoop, CONFIG.UPDATE_INTERVAL);
    }
}

// Обработчики событий
function initEventHandlers() {
    console.log('Initializing event handlers...');
    
    // Старт
    document.getElementById('startBtn').addEventListener('click', async () => {
        console.log('Start button clicked');
        
        if (state.status === 'running') {
            console.log('Already running');
            return;
        }

        try {
            console.log('Starting learning process...');
            addLog('Начинаем процесс обучения...', 'info');
            
            if (!model) {
                console.log('Creating model...');
                model = await createModel();
                if (!model) {
                    console.error('Failed to create model');
                    addLog('Не удалось создать модель', 'error');
                    showNotification('Ошибка создания модели', 'error');
                    return;
                }
                console.log('Model created successfully');
            }

            const symbol = document.getElementById('symbolSelect').value;
            const interval = document.getElementById('timeframeSelect').value;
            
            console.log(`Loading data for ${symbol} with interval ${interval}`);
            addLog(`Загрузка данных для ${symbol} (${interval})...`, 'info');
            
            const data = await fetchData(symbol, interval, 100);

            if (data && data.length > 0) {
                console.log(`Loaded ${data.length} candles`);
                state.priceData = calculateIndicators(data);
                state.sessionStart = Date.now();
                state.status = 'running';

                document.getElementById('startBtn').disabled = true;
                document.getElementById('pauseBtn').disabled = false;

                addLog('Обучение начато!', 'info', 
                       'Нейросеть начала анализировать рынок и учиться на своих решениях');
                showNotification('Нейросеть начала обучение', 'info');

                console.log('Starting main loop...');
                mainLoop();
            } else {
                console.error('No data loaded');
                addLog('Не удалось загрузить данные', 'error');
                showNotification('Ошибка загрузки данных', 'error');
            }
        } catch (error) {
            console.error('Error starting learning:', error);
            addLog('Ошибка при запуске обучения: ' + error.message, 'error');
            showNotification('Ошибка при запуске обучения', 'error');
        }
    });

    // Пауза
    document.getElementById('pauseBtn').addEventListener('click', () => {
        console.log('Pause button clicked');
        
        if (state.status === 'running') {
            state.status = 'paused';
            document.getElementById('pauseBtn').textContent = '▶ Продолжить';
            addLog('Обучение приостановлено', 'warning', 
                   'Нейросеть остановила обучение, но помнит всё что выучила');
        } else if (state.status === 'paused') {
            state.status = 'running';
            document.getElementById('pauseBtn').textContent = '⏸ Пауза';
            addLog('Обучение продолжено', 'info');
            mainLoop();
        }
    });

    // Анализ последнего решения
    document.getElementById('analyzeDecisionBtn').addEventListener('click', () => {
        console.log('Analyze button clicked');
        const analysis = analyzeLastDecision();
        addLog('🔍 Анализ последнего решения', 'debug', analysis);
    });

    // Отчет обучения
    document.getElementById('learningReportBtn').addEventListener('click', () => {
        console.log('Learning report button clicked');
        const report = generateLearningReport();
        addLog('📊 Полный отчет об обучении', 'info', report);
    });

    // Принудительный SELL
    document.getElementById('forceSellBtn').addEventListener('click', () => {
        console.log('Force SELL button clicked');
        
        if (state.status !== 'running') {
            showNotification('Сначала запустите обучение', 'warning');
            return;
        }
        
        if (state.priceData.length === 0) {
            showNotification('Нет данных для принятия решения', 'warning');
            return;
        }
        
        state.forcedDecision = {
            decision: 'SELL',
            reason: 'Принудительное решение пользователя',
            time: Date.now()
        };
        
        const currentPrice = state.priceData[state.priceData.length - 1].close;
        const forcedPrediction = {
            time: Date.now(),
            price: currentPrice,
            probability: 0.8,
            decision: 'SELL',
            result: null,
            forced: true,
            reason: 'Принудительное решение пользователя'
        };

        state.lastPrediction = forcedPrediction;
        
        addLog('Пользователь принудительно установил SELL', 'warning',
               `Цена: ${currentPrice.toFixed(2)} | Это решение будет проверено на следующей свече`);
        showNotification('Принудительный SELL установлен', 'info');
    });

    // Принудительный BUY
    document.getElementById('forceBuyBtn').addEventListener('click', () => {
        console.log('Force BUY button clicked');
        
        if (state.status !== 'running') {
            showNotification('Сначала запустите обучение', 'warning');
            return;
        }
        
        if (state.priceData.length === 0) {
            showNotification('Нет данных для принятия решения', 'warning');
            return;
        }
        
        state.forcedDecision = {
            decision: 'BUY',
            reason: 'Принудительное решение пользователя',
            time: Date.now()
        };
        
        const currentPrice = state.priceData[state.priceData.length - 1].close;
        const forcedPrediction = {
            time: Date.now(),
            price: currentPrice,
            probability: 0.8,
            decision: 'BUY',
            result: null,
            forced: true,
            reason: 'Принудительное решение пользователя'
        };

        state.lastPrediction = forcedPrediction;
        
        addLog('Пользователь принудительно установил BUY', 'warning',
               `Цена: ${currentPrice.toFixed(2)} | Это решение будет проверено на следующей свече`);
        showNotification('Принудительный BUY установлен', 'info');
    });

    // Сохранить
    document.getElementById('saveBtn').addEventListener('click', saveModel);

    // Загрузить
    document.getElementById('loadBtn').addEventListener('click', loadModel);

    // Сброс
    document.getElementById('resetBtn').addEventListener('click', () => {
        console.log('Reset button clicked');
        
        if (confirm('ВНИМАНИЕ! Сбросить модель и все данные?\nВся память обучения будет потеряна.')) {
            model = null;
            state = {
                status: 'stopped',
                balance: CONFIG.INITIAL_BALANCE,
                predictions: [],
                priceData: [],
                balanceHistory: [{time: Date.now(), balance: CONFIG.INITIAL_BALANCE}],
                accuracyHistory: [],
                confidenceHistory: [],
                sessionStart: null,
                indicators: {},
                lastPrediction: null,
                learningMetrics: {
                    stage: 'data_gathering',
                    understanding: 0,
                    efficiency: 0,
                    memoryUsed: 0,
                    patternsFound: 0
                },
                forcedDecision: null
            };

            // Сброс опыта
            experienceDB = {
                patterns: [],
                marketConditions: [],
                decisions: [],
                learnedRules: [],
                statistics: {
                    totalDecisions: 0,
                    successfulBuys: 0,
                    failedBuys: 0,
                    successfulSells: 0,
                    failedSells: 0,
                    accuracyByMarketCondition: {},
                    bestParameters: {}
                },
                memoryUsage: 0,
                lastAnalysis: null
            };

            persistExperience();

            document.getElementById('startBtn').disabled = false;
            document.getElementById('pauseBtn').disabled = true;
            document.getElementById('pauseBtn').textContent = '⏸ Пауза';

            updateUI();
            updateCharts();
            updateIndicatorsTable();
            updateLearningMetrics();
            visualizeExperienceUsage();
            updatePatternsList();

            addLog('Система полностью сброшена', 'warning', 
                   'Нейросеть забыла всё обучение. Начинаем с чистого листа.');
            showNotification('Система полностью сброшена', 'info');
        }
    });

    // Очистка лога
    document.getElementById('clearLogBtn').addEventListener('click', () => {
        console.log('Clear log button clicked');
        document.getElementById('logContent').innerHTML = '';
        addLog('Лог очищен', 'info');
    });

    // Прокрутка вверх
    const scrollTopBtn = document.getElementById('scrollTopBtn');
    if (scrollTopBtn) {
        scrollTopBtn.addEventListener('click', () => {
            window.scrollTo({top: 0, behavior: 'smooth'});
        });

        window.addEventListener('scroll', () => {
            scrollTopBtn.style.display = window.scrollY > 300 ? 'flex' : 'none';
        });
    }

    // Изменение настроек
    document.getElementById('symbolSelect').addEventListener('change', () => {
        console.log('Symbol changed');
        if (state.status === 'running') {
            addLog('Изменена торговая пара', 'info', 'Нейросеть продолжит обучение с новыми данными');
        }
    });

    document.getElementById('timeframeSelect').addEventListener('change', () => {
        console.log('Timeframe changed');
        if (state.status === 'running') {
            addLog('Изменен таймфрейм', 'info', 'Нейросеть адаптируется к новому интервалу');
        }
    });
}

// Инициализация
async function init() {
    console.log('Initializing application...');
    
    try {
        // Проверяем загрузку TensorFlow.js
        if (typeof tf === 'undefined') {
            throw new Error('TensorFlow.js не загружен. Проверьте подключение к интернету.');
        }
        
        console.log('TensorFlow.js loaded:', tf.version.tfjs);

        // Загружаем опыт
        loadExperience();

        // Инициализируем обработчики
        initEventHandlers();
        
        // Пытаемся загрузить модель
        try {
            await loadModel();
        } catch (modelError) {
            console.warn('Model not loaded, will create new:', modelError);
        }

        // Обновляем UI
        updateUI();
        updateIndicatorsTable();
        updateLearningMetrics();
        visualizeExperienceUsage();
        updatePatternsList();

        addLog('Система успешно инициализирована', 'info', 
               '1. Нажмите "Старт обучения" чтобы начать\n' +
               '2. Используйте принудительные кнопки для балансировки\n' +
               '3. Смотрите отчеты для анализа работы');
        
        showNotification('Нейросеть-трейдер готова к работе', 'info');

    } catch (error) {
        console.error('Ошибка инициализации:', error);
        addLog('Критическая ошибка инициализации: ' + error.message, 'error');
        showNotification('Ошибка инициализации: ' + error.message, 'error');
        
        // Показываем простой интерфейс даже при ошибке
        updateUI();
    }
}

// Запуск при загрузке страницы
window.addEventListener('DOMContentLoaded', init);

// Глобальная обработка ошибок
window.addEventListener('error', function(event) {
    console.error('Global error:', event.error);
    addLog('Неожиданная ошибка: ' + event.error.message, 'error');
});

// Обработка промисов без catch
window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled promise rejection:', event.reason);
    addLog('Необработанная ошибка промиса: ' + event.reason.message, 'error');
});
