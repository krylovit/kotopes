// Основной цикл приложения
async function mainLoop() {
    console.log('mainLoop вызван, статус:', state.status);
    
    if (state.status !== 'running') {
        console.log('Не работает, выходим из mainLoop');
        return;
    }

    try {
        const symbol = document.getElementById('symbolSelect').value || 'BTCUSDT';
        const interval = document.getElementById('timeframeSelect').value || '5m';

        console.log('Загрузка новых данных...');
        // Загружаем данные
        const newData = await fetchData(symbol, interval, 10);
        
        if (!newData || newData.length === 0) {
            console.log('Нет данных, повторная попытка...');
            setTimeout(mainLoop, CONFIG.UPDATE_INTERVAL);
            return;
        }

        console.log(`Получено новых свечей: ${newData.length}`);
        
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
        if (typeof updatePatternsList === 'function') {
            updatePatternsList();
        }

        // Делаем прогноз
        if (state.priceData.length >= CONFIG.LOOKBACK) {
            console.log('Делаем предсказание...');
            const prediction = await makePrediction();

            if (prediction) {
                state.lastPrediction = prediction;

                // Ждем следующую свечу для проверки
                setTimeout(async () => {
                    console.log('Проверяем результат предсказания...');
                    const checkData = await fetchData(symbol, interval, 1);
                    if (checkData && checkData.length > 0) {
                        const actualPrice = checkData[0].close;
                        evaluatePrediction(prediction, actualPrice);
                        updateCharts();
                        updateUI();
                        updateLearningMetrics();
                    } else {
                        console.log('Нет данных для проверки');
                    }
                }, 5000);
            } else {
                console.log('Предсказание не сделано');
            }
        } else {
            console.log(`Недостаточно данных для предсказания: ${state.priceData.length}/${CONFIG.LOOKBACK}`);
        }

        updateCharts();
        updateUI();
        updateLearningMetrics();

        // Следующий цикл
        console.log('Планируем следующий цикл...');
        setTimeout(mainLoop, CONFIG.UPDATE_INTERVAL);

    } catch (error) {
        console.error('Ошибка в цикле:', error);
        addLog('Ошибка в основном цикле: ' + error.message, 'warning');
        setTimeout(mainLoop, CONFIG.UPDATE_INTERVAL);
    }
}

// Обработчики событий
function initEventHandlers() {
    console.log('Инициализация обработчиков событий...');
    
    // Старт
    document.getElementById('startBtn').addEventListener('click', async () => {
        console.log('Кнопка Старт нажата');
        
        if (state.status === 'running') {
            console.log('Уже работает');
            return;
        }

        try {
            console.log('Начинаем процесс обучения...');
            addLog('Начинаем процесс обучения...', 'info');
            
            if (!model) {
                console.log('Создаем модель...');
                const createdModel = await createModel();
                if (!createdModel) {
                    console.error('Не удалось создать модель');
                    addLog('Не удалось создать модель', 'error');
                    showNotification('Ошибка создания модели', 'error');
                    return;
                }
                console.log('Модель успешно создана');
            }

            const symbol = document.getElementById('symbolSelect').value || 'BTCUSDT';
            const interval = document.getElementById('timeframeSelect').value || '5m';
            
            console.log(`Загрузка данных для ${symbol} с интервалом ${interval}`);
            addLog(`Загрузка данных для ${symbol} (${interval})...`, 'info');
            
            const data = await fetchData(symbol, interval, 100);

            if (data && data.length > 0) {
                console.log(`Загружено свечей: ${data.length}`);
                state.priceData = calculateIndicators(data);
                state.sessionStart = Date.now();
                state.status = 'running';

                document.getElementById('startBtn').disabled = true;
                document.getElementById('pauseBtn').disabled = false;

                addLog('Обучение начато!', 'info', 
                       'Нейросеть начала анализировать рынок и учиться на своих решениях');
                showNotification('Нейросеть начала обучение', 'info');

                console.log('Запускаем основной цикл...');
                mainLoop();
            } else {
                console.error('Данные не загружены');
                addLog('Не удалось загрузить данные', 'error');
                showNotification('Ошибка загрузки данных', 'error');
            }
        } catch (error) {
            console.error('Ошибка при запуске обучения:', error);
            addLog('Ошибка при запуске обучения: ' + error.message, 'error');
            showNotification('Ошибка при запуске обучения', 'error');
        }
    });

    // Пауза
    document.getElementById('pauseBtn').addEventListener('click', () => {
        console.log('Кнопка Пауза нажата');
        
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
        console.log('Кнопка Анализ нажата');
        const analysis = analyzeLastDecision();
        addLog('🔍 Анализ последнего решения', 'debug', analysis);
    });

    // Отчет обучения
    document.getElementById('learningReportBtn').addEventListener('click', () => {
        console.log('Кнопка Отчет нажата');
        const report = generateLearningReport();
        addLog('📊 Полный отчет об обучении', 'info', report);
    });

    // Принудительный SELL
    document.getElementById('forceSellBtn').addEventListener('click', () => {
        console.log('Кнопка Принудительный SELL нажата');
        
        if (state.status !== 'running') {
            showNotification('Сначала запустите обучение', 'warning');
            return;
        }
        
        if (state.priceData.length === 0) {
            showNotification('Нет данных для принятия решения', 'warning');
            return;
        }
        
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
        
        // Ждем следующую свечу для проверки
        setTimeout(async () => {
            const symbol = document.getElementById('symbolSelect').value || 'BTCUSDT';
            const interval = document.getElementById('timeframeSelect').value || '5m';
            const checkData = await fetchData(symbol, interval, 1);
            if (checkData && checkData.length > 0) {
                const actualPrice = checkData[0].close;
                evaluatePrediction(forcedPrediction, actualPrice);
                updateCharts();
                updateUI();
                updateLearningMetrics();
            }
        }, 5000);
    });

    // Принудительный BUY
    document.getElementById('forceBuyBtn').addEventListener('click', () => {
        console.log('Кнопка Принудительный BUY нажата');
        
        if (state.status !== 'running') {
            showNotification('Сначала запустите обучение', 'warning');
            return;
        }
        
        if (state.priceData.length === 0) {
            showNotification('Нет данных для принятия решения', 'warning');
            return;
        }
        
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
        
        // Ждем следующую свечу для проверки
        setTimeout(async () => {
            const symbol = document.getElementById('symbolSelect').value || 'BTCUSDT';
            const interval = document.getElementById('timeframeSelect').value || '5m';
            const checkData = await fetchData(symbol, interval, 1);
            if (checkData && checkData.length > 0) {
                const actualPrice = checkData[0].close;
                evaluatePrediction(forcedPrediction, actualPrice);
                updateCharts();
                updateUI();
                updateLearningMetrics();
            }
        }, 5000);
    });

    // Сохранить
    document.getElementById('saveBtn').addEventListener('click', () => {
        if (window.saveModel) {
            saveModel();
        } else {
            showNotification('Функция сохранения не доступна', 'error');
        }
    });

    // Загрузить
    document.getElementById('loadBtn').addEventListener('click', () => {
        if (window.loadModel) {
            loadModel();
        } else {
            showNotification('Функция загрузки не доступна', 'error');
        }
    });

    // Сброс
    document.getElementById('resetBtn').addEventListener('click', () => {
        console.log('Кнопка Сброс нажата');
        
        if (confirm('ВНИМАНИЕ! Сбросить модель и все данные?\nВся память обучения будет потеряна.')) {
            // Сбрасываем глобальные переменные
            model = null;
            
            // Восстанавливаем начальное состояние
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
                }
            };

            // Сбрасываем опыт
            if (window.experienceDB) {
                window.experienceDB = {
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
                        accuracyByMarketCondition: {}
                    },
                    memoryUsage: 0
                };
                
                localStorage.removeItem('neuro_trader_experience_v1');
            }

            localStorage.removeItem('neuro_trader_lstm_model_v5');
            localStorage.removeItem('neuro_trader_model_state');

            document.getElementById('startBtn').disabled = false;
            document.getElementById('pauseBtn').disabled = true;
            document.getElementById('pauseBtn').textContent = '⏸ Пауза';

            updateUI();
            updateCharts();
            updateIndicatorsTable();
            updateLearningMetrics();
            
            if (typeof visualizeExperienceUsage === 'function') {
                visualizeExperienceUsage();
            }
            
            if (typeof updatePatternsList === 'function') {
                updatePatternsList();
            }

            addLog('Система полностью сброшена', 'warning', 
                   'Нейросеть забыла всё обучение. Начинаем с чистого листа.');
            showNotification('Система полностью сброшена', 'info');
        }
    });

    // Очистка лога
    document.getElementById('clearLogBtn').addEventListener('click', () => {
        console.log('Кнопка Очистить лог нажата');
        const logContent = document.getElementById('logContent');
        if (logContent) {
            logContent.innerHTML = '';
            addLog('Лог очищен', 'info');
        }
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
        console.log('Торговая пара изменена');
        if (state.status === 'running') {
            addLog('Изменена торговая пара', 'info', 'Нейросеть продолжит обучение с новыми данными');
        }
    });

    document.getElementById('timeframeSelect').addEventListener('change', () => {
        console.log('Таймфрейм изменен');
        if (state.status === 'running') {
            addLog('Изменен таймфрейм', 'info', 'Нейросеть адаптируется к новому интервалу');
        }
    });
}

// Инициализация
async function init() {
    console.log('Инициализация приложения...');
    
    try {
        // Проверяем загрузку TensorFlow.js
        if (typeof tf === 'undefined') {
            throw new Error('TensorFlow.js не загружен. Проверьте подключение к интернету.');
        }
        
        console.log('TensorFlow.js загружен:', tf.version.tfjs);

        // Загружаем опыт
        if (typeof loadExperience === 'function') {
            loadExperience();
        } else {
            console.error('Функция loadExperience не найдена!');
        }

        // Инициализируем обработчики
        initEventHandlers();
        
        // Пытаемся загрузить модель
        try {
            if (typeof loadModel === 'function') {
                await loadModel();
            }
        } catch (modelError) {
            console.warn('Модель не загружена, создадим новую:', modelError);
        }

        // Обновляем UI
        updateUI();
        updateIndicatorsTable();
        updateLearningMetrics();
        
        if (typeof visualizeExperienceUsage === 'function') {
            visualizeExperienceUsage();
        }
        
        if (typeof updatePatternsList === 'function') {
            updatePatternsList();
        }

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
    console.error('Глобальная ошибка:', event.error);
    addLog('Неожиданная ошибка: ' + event.error.message, 'error');
});

// Обработка промисов без catch
window.addEventListener('unhandledrejection', function(event) {
    console.error('Необработанное отклонение промиса:', event.reason);
    addLog('Необработанная ошибка промиса: ' + event.reason.message, 'error');
});

// Экспортируем основные функции
window.mainLoop = mainLoop;
window.init = init;
