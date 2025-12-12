// Глобальное состояние приложения
let charts = {};
let state = {
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

// Основной цикл приложения
async function mainLoop() {
    if (state.status !== 'running') return;

    try {
        const symbol = document.getElementById('symbolSelect').value;
        const interval = document.getElementById('timeframeSelect').value;

        // Загружаем данные
        const newData = await fetchData(symbol, interval, 10);
        if (!newData || newData.length === 0) {
            setTimeout(mainLoop, CONFIG.UPDATE_INTERVAL);
            return;
        }

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

        // Проверяем принудительное решение
        if (state.forcedDecision) {
            const forcedPrediction = {
                time: Date.now(),
                price: state.priceData[state.priceData.length - 1].close,
                probability: 0.8,
                decision: state.forcedDecision.decision,
                result: null,
                forced: true,
                reason: state.forcedDecision.reason
            };

            state.lastPrediction = forcedPrediction;
            state.forcedDecision = null;

            // Ждем следующую свечу для проверки
            setTimeout(async () => {
                const checkData = await fetchData(symbol, interval, 1);
                if (checkData && checkData.length > 0) {
                    const actualPrice = checkData[0].close;
                    evaluatePrediction(forcedPrediction, actualPrice);
                    updateCharts();
                    updateUI();
                    updateLearningMetrics();
                }
            }, 5000);
        } else {
            // Делаем обычный прогноз
            if (state.priceData.length >= CONFIG.LOOKBACK) {
                const prediction = await makePrediction();

                if (prediction) {
                    state.lastPrediction = prediction;

                    // Ждем следующую свечу для проверки
                    setTimeout(async () => {
                        const checkData = await fetchData(symbol, interval, 1);
                        if (checkData && checkData.length > 0) {
                            const actualPrice = checkData[0].close;
                            evaluatePrediction(prediction, actualPrice);
                            updateCharts();
                            updateUI();
                            updateLearningMetrics();
                        }
                    }, 5000);
                }
            }
        }

        updateCharts();
        updateUI();
        updateLearningMetrics();

        // Следующий цикл
        setTimeout(mainLoop, CONFIG.UPDATE_INTERVAL);

    } catch (error) {
        console.error('Ошибка в цикле:', error);
        addLog('Ошибка в основном цикле: ' + error.message, 'warning');
        setTimeout(mainLoop, CONFIG.UPDATE_INTERVAL);
    }
}

function updatePatternsList() {
    const patternsList = document.getElementById('patternsList');
    if (!patternsList) return;

    if (experienceDB.patterns.length === 0) {
        patternsList.innerHTML = `
            <div style="text-align: center; padding: 15px; color: #94a3b8;">
                Паттерны будут появляться по мере обучения...
            </div>
        `;
        return;
    }

    const recentPatterns = experienceDB.patterns
        .sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen))
        .slice(0, 5);

    let html = '';
    recentPatterns.forEach(pattern => {
        const typeIcon = pattern.decision === 'BUY' ? '🟢' : '🔴';
        const successRate = (pattern.successRate * 100).toFixed(1);
        const occurrences = pattern.occurrences;
        
        html += `
            <div style="padding: 8px 12px; border-bottom: 1px solid #334155; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <span style="font-size: 14px;">${typeIcon} ${pattern.decision}</span>
                    <div style="font-size: 11px; color: #94a3b8;">
                        Успешность: ${successRate}% (${occurrences} раз)
                    </div>
                </div>
                <div style="font-size: 10px; color: #64748b;">
                    ${new Date(pattern.lastSeen).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
                </div>
            </div>
        `;
    });

    patternsList.innerHTML = html;
}

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

💡 РЕКОМЕНДАЦИИ:
${getLearningRecommendations()}

📈 СТАТУС: ${state.learningMetrics.stage === 'pattern_recognition' ? 'РАСПОЗНАВАНИЕ ПАТТЕРНОВ' : 'АКТИВНОЕ ОБУЧЕНИЕ'}
`;

    return report;
}

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
    // Старт
    document.getElementById('startBtn').addEventListener('click', async () => {
        if (state.status === 'running') return;

        if (!model) {
            model = await createModel();
            if (!model) return;
        }

        const symbol = document.getElementById('symbolSelect').value;
        const interval = document.getElementById('timeframeSelect').value;
        const data = await fetchData(symbol, interval, 100);

        if (data && data.length > 0) {
            state.priceData = calculateIndicators(data);
            state.sessionStart = Date.now();
            state.status = 'running';

            document.getElementById('startBtn').disabled = true;
            document.getElementById('pauseBtn').disabled = false;

            addLog('Обучение начато', 'info', 
                   'Нейросеть начала анализировать рынок и учиться на своих решениях');
            showNotification('Нейросеть начала обучение', 'info');

            mainLoop();
        }
    });

    // Пауза
    document.getElementById('pauseBtn').addEventListener('click', () => {
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
        const analysis = analyzeLastDecision();
        addLog('🔍 Детальный анализ последнего решения', 'debug', analysis);
    });

    // Отчет обучения
    document.getElementById('learningReportBtn').addEventListener('click', () => {
        const report = generateLearningReport();
        addLog('📊 Полный отчет об обучении нейросети', 'info', report);
    });

    // Принудительный SELL
    document.getElementById('forceSellBtn').addEventListener('click', () => {
        if (state.status !== 'running') {
            showNotification('Сначала запустите обучение', 'warning');
            return;
        }
        
        state.forcedDecision = {
            decision: 'SELL',
            reason: 'Принудительное решение пользователя'
        };
        
        addLog('Пользователь принудительно установил SELL', 'warning',
               'Это решение будет проверено на следующей свече');
        showNotification('Принудительный SELL установлен', 'info');
    });

    // Принудительный BUY
    document.getElementById('forceBuyBtn').addEventListener('click', () => {
        if (state.status !== 'running') {
            showNotification('Сначала запустите обучение', 'warning');
            return;
        }
        
        state.forcedDecision = {
            decision: 'BUY',
            reason: 'Принудительное решение пользователя'
        };
        
        addLog('Пользователь принудительно установил BUY', 'warning',
               'Это решение будет проверено на следующей свече');
        showNotification('Принудительный BUY установлен', 'info');
    });

    // Сохранить
    document.getElementById('saveBtn').addEventListener('click', saveModel);

    // Загрузить
    document.getElementById('loadBtn').addEventListener('click', loadModel);

    // Сброс
    document.getElementById('resetBtn').addEventListener('click', () => {
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
        document.getElementById('logContent').innerHTML = `
            <div class="log-entry">
                <div class="log-time">${new Date().toLocaleTimeString()}</div>
                <div class="log-message log-info">Лог очищен пользователем</div>
            </div>
        `;
        addLog('Лог очищен', 'info');
    });

    // Экспорт лога
    document.getElementById('exportLogBtn').addEventListener('click', () => {
        const logEntries = document.querySelectorAll('.log-entry');
        let logText = 'Лог решений нейросети-трейдера\n';
        logText += '===============================\n\n';
        
        logEntries.forEach(entry => {
            const time = entry.querySelector('.log-time').textContent;
            const message = entry.querySelector('.log-message').textContent;
            logText += `${time} - ${message}\n`;
        });
        
        const blob = new Blob([logText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `neuro-trader-log-${new Date().toISOString().slice(0,10)}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        addLog('Лог экспортирован в файл', 'info');
    });

    // Прокрутка вверх
    document.getElementById('scrollTopBtn').addEventListener('click', () => {
        window.scrollTo({top: 0, behavior: 'smooth'});
    });

    window.addEventListener('scroll', () => {
        const btn = document.getElementById('scrollTopBtn');
        btn.style.display = window.scrollY > 300 ? 'flex' : 'none';
    });

    // Изменение настроек в реальном времени
    document.getElementById('symbolSelect').addEventListener('change', () => {
        if (state.status === 'running') {
            addLog('Изменена торговая пара', 'info', 'Нейросеть продолжит обучение с новыми данными');
        }
    });

    document.getElementById('timeframeSelect').addEventListener('change', () => {
        if (state.status === 'running') {
            addLog('Изменен таймфрейм', 'info', 'Нейросеть адаптируется к новому интервалу');
        }
    });

    document.getElementById('riskLevel').addEventListener('change', (e) => {
        const risk = parseFloat(e.target.value);
        let riskText = '';
        if (risk === 0.5) riskText = 'консервативная';
        else if (risk === 1) riskText = 'нормальная';
        else if (risk === 1.5) riskText = 'агрессивная';
        else riskText = 'очень агрессивная';
        
        addLog('Изменена стратегия рисков', 'info', `Новая стратегия: ${riskText}`);
    });
}

// Инициализация
async function init() {
    console.log('Инициализация системы с улучшенной стратегией...');
    addLog('Инициализация системы...', 'info', 
           'Загрузка нейросети с системой накопления опыта и балансировкой решений');

    showLoader(true, 'Инициализация...');

    try {
        if (!tf) {
            throw new Error('TensorFlow.js не загружен');
        }

        // Загружаем опыт
        loadExperience();

        initEventHandlers();
        await loadModel();

        updateUI();
        updateIndicatorsTable();
        updateLearningMetrics();
        visualizeExperienceUsage();
        updatePatternsList();

        addLog('Система готова к работе', 'info', 
               '1. Нажмите "Старт обучения" чтобы начать\n' +
               '2. Нейросеть использует балансировку BUY/SELL\n' +
               '3. Все решения сохраняются в память обучения\n' +
               '4. Используйте кнопки анализа для глубокого понимания');

        showNotification('Нейросеть-трейдер готова с улучшенной стратегией', 'info');

    } catch (error) {
        console.error('Ошибка инициализации:', error);
        addLog('Ошибка инициализации: ' + error.message, 'warning');
        showNotification('Ошибка инициализации: ' + error.message, 'error');
    } finally {
        showLoader(false);
    }
}

window.addEventListener('DOMContentLoaded', init);
