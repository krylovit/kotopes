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
        if (typeof updatePatternsList === 'function') {
            updatePatternsList();
        }

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

// Генерация отчета обучения
function generateLearningReport() {
    const predictions = state.predictions;
    const total = predictions.length;

    if (total === 0) {
        return "Нейросеть еще не сделала ни одного прогноза.";
    }

    const recent = predictions.slice(-20);
    const recentAccuracy = recent.filter(p => p.result?.isCorrect).length / recent.length * 100;
    const totalAccuracy = predictions.filter(p => p.result?.isCorrect).length / total * 100;

    const buyPredictions = predictions.filter(p => p.decision === 'BUY');
    const sellPredictions = predictions.filter(p => p.decision === 'SELL');
    const buyAccuracy = buyPredictions.filter(p => p.result?.isCorrect).length / buyPredictions.length * 100 || 0;
    const sellAccuracy = sellPredictions.filter(p => p.result?.isCorrect).length / sellPredictions.length * 100 || 0;

    const confidenceCorrect = recent
        .filter(p => p.result?.isCorrect)
        .reduce((sum, p) => sum + p.probability, 0) / recent.filter(p => p.result?.isCorrect).length || 0;

    const confidenceWrong = recent
        .filter(p => p.result && !p.result.isCorrect)
        .reduce((sum, p) => sum + p.probability, 0) / recent.filter(p => p.result && !p.result.isCorrect).length || 0;

    const patternsFound = experienceDB.patterns.length;
    const memoryUsed = experienceDB.memoryUsage > 0 ? ((experienceDB.memoryUsage / 1024).toFixed(1) + 'KB') : '0KB';

    let analysis = "";

    if (recentAccuracy > 60) {
        analysis = "✅ Нейросеть эффективно обучается и выявляет рыночные закономерности";
    } else if (recentAccuracy > 55) {
        analysis = "⚠️ Нейросеть учится, но нужны дополнительные данные для стабильности";
    } else if (recentAccuracy > 50) {
        analysis = "🔍 Нейросеть находится в процессе обучения, точность чуть выше случайной";
    } else {
        analysis = "🎯 Нейросеть изучает рынок, пока не выявила четких закономерностей";
    }

    if (Math.abs(buyAccuracy - sellAccuracy) > 20) {
        analysis += "\n📊 Нейросеть лучше работает с " + (buyAccuracy > sellAccuracy ? "BUY" : "SELL") + " сигналами";
    }

    if (confidenceCorrect > 0.7 && confidenceWrong < 0.5) {
        analysis += "\n🧠 Нейросеть уверена в правильных решениях и сомневается в ошибках - хороший признак";
    }

    const report = `
🧠 ПОЛНЫЙ ОТЧЕТ ОБ ОБУЧЕНИИ
==============================

📊 ОСНОВНЫЕ МЕТРИКИ:
• Всего прогнозов: ${total}
• Точность (все время): ${totalAccuracy.toFixed(1)}%
• Точность (последние 20): ${recentAccuracy.toFixed(1)}%
• Баланс: ${state.balance.toFixed(2)} USDT
• Прибыль/убыток: ${(state.balance - CONFIG.INITIAL_BALANCE).toFixed(2)} USDT

🎯 ДЕТАЛЬНАЯ СТАТИСТИКА:
• Точность BUY: ${buyAccuracy.toFixed(1)}% (прогнозов: ${buyPredictions.length})
• Точность SELL: ${sellAccuracy.toFixed(1)}% (прогнозов: ${sellPredictions.length})
• Средняя уверенность (правильные): ${(confidenceCorrect * 100).toFixed(1)}%
• Средняя уверенность (ошибки): ${(confidenceWrong * 100).toFixed(1)}%

🧠 ПАМЯТЬ ОБУЧЕНИЯ:
• Паттернов найдено: ${patternsFound}
• Использовано памяти: ${memoryUsed}
• Решений в памяти: ${experienceDB.decisions.length}

🔍 АНАЛИЗ ОБУЧЕНИЯ:
${analysis}

📈 СТАТУС: ${state.learningMetrics.stage === 'pattern_recognition' ? 'РАСПОЗНАВАНИЕ ПАТТЕРНОВ' : 'АКТИВНОЕ ОБУЧЕНИЕ'}
`;

    return report;
}

// Анализ последнего решения
function analyzeLastDecision() {
    if (!state.lastPrediction) {
        return "Нет данных о последнем решении";
    }

    const pred = state.lastPrediction;
    const confidence = (pred.probability * 100).toFixed(1);

    let analysis = "";

    if (pred.probability > 0.7) {
        analysis = "🧠 Нейросеть ВЫСОКО уверена в этом решении";
    } else if (pred.probability > 0.6) {
        analysis = "🤔 Нейросеть умеренно уверена";
    } else {
        analysis = "🎯 Нейросеть НЕУВЕРЕННА, решение на грани";
    }

    if (pred.experienceBased) {
        analysis += "\n📚 Решение основано на предыдущем успешном опыте";
    }

    if (pred.forced) {
        analysis += "\n⚠️ Это было ПРИНУДИТЕЛЬНОЕ решение пользователя";
    }

    if (pred.result) {
        analysis += pred.result.isCorrect ? 
            "\n✅ Прогноз был ПРАВИЛЬНЫМ - нейросеть запомнит этот успех" :
            "\n❌ Прогноз был ОШИБОЧНЫМ - нейросеть скорректирует веса";
    }

    const marketContext = analyzeMarketContext();
    const marketAnalysis = `
Текущие рыночные условия:
• Тренд: ${marketContext.trend}
• Волатильность: ${marketContext.volatility}
• RSI: ${marketContext.rsiExtreme}
• Объем: ${marketContext.volume}
    `;

    return `
🔍 ДЕТАЛЬНЫЙ АНАЛИЗ ПОСЛЕДНЕГО РЕШЕНИЯ
======================================

📊 РЕШЕНИЕ:
• Тип: ${pred.decision} ${pred.forced ? '(ПРИНУДИТЕЛЬНО)' : ''}
• Уверенность: ${confidence}%
• Цена в момент решения: ${pred.price.toFixed(2)}
${pred.result ? `• Реальная цена: ${pred.result.actualPrice.toFixed(2)}` : ''}
${pred.result ? `• Изменение: ${pred.result.priceChangePercent}%` : ''}
${pred.result ? `• Результат: ${pred.result.isCorrect ? '✅ ПРАВИЛЬНО' : '❌ ОШИБКА'}` : ''}

🤔 КАК ПРИНИМАЛОСЬ РЕШЕНИЕ:
1. Проанализировано ${CONFIG.LOOKBACK} свечей
2. Уверенность модели: ${confidence}%
3. Балансировка классов: ${pred.classBalanceCorrection ? 'применена' : 'не применялась'}
4. Коррекция по рынку: ${pred.marketAdjustment ? pred.marketAdjustment.toFixed(3) : '0'}
5. Порог принятия: ${pred.dynamicThreshold ? pred.dynamicThreshold.toFixed(3) : '0.5'}

${marketAnalysis}

${analysis}

💡 ВЛИЯНИЕ НА ОБУЧЕНИЕ:
${pred.result && pred.result.isCorrect ? 
    '• Усиливаем веса для подобных ситуаций' :
    '• Ослабляем веса, корректируем стратегию'}
`;
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
            const symbol = document.getElementById('symbolSelect').value;
            const interval = document.getElementById('timeframeSelect').value;
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
        console.log('Force BUY button clicked');
        
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
            const symbol = document.getElementById('symbolSelect').value;
            const interval = document.getElementById('timeframeSelect').value;
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
                }
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
        if (typeof loadExperience === 'function') {
            loadExperience();
        } else {
            console.error('loadExperience function not found!');
        }

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
    console.error('Global error:', event.error);
    addLog('Неожиданная ошибка: ' + event.error.message, 'error');
});

// Обработка промисов без catch
window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled promise rejection:', event.reason);
    addLog('Необработанная ошибка промиса: ' + event.reason.message, 'error');
});
