// Конфигурация приложения
const CONFIG = {
    INITIAL_BALANCE: 1000.0,
    DEFAULT_BET: 10,
    LOOKBACK: 50,
    UPDATE_INTERVAL: 30000,
    API_URL: 'https://api.binance.com/api/v3/klines',
    FEATURES: 8,
    MODEL_KEY: 'neuro_trader_lstm_model_v5'
};

// Система накопления опыта
const EXPERIENCE = {
    STORAGE_KEY: 'neuro_trader_experience_v1',
    MAX_MEMORY: 5000,
    PATTERN_TYPES: {
        SUCCESSFUL_BUY: 'successful_buy',
        FAILED_BUY: 'failed_buy',
        SUCCESSFUL_SELL: 'successful_sell',
        FAILED_SELL: 'failed_sell'
    }
};

// База знаний нейросети
let experienceDB = {
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

// Стратегия обучения
const STRATEGY = {
    dynamicThreshold: {
        base: 0.5,
        adjustment: 0.1,
        min: 0.3,
        max: 0.7
    },
    classBalance: {
        targetBuySellRatio: 0.5,
        currentRatio: 1.0,
        correctionFactor: 0.05
    }
};

// Глобальная переменная модели
let model = null;

// Работа с LSTM моделью
async function createModel() {
    showLoader(true, 'Создание LSTM модели...');

    try {
        const newModel = tf.sequential();

        // Первый LSTM слой
        newModel.add(tf.layers.lstm({
            units: 64,
            inputShape: [CONFIG.LOOKBACK, CONFIG.FEATURES],
            returnSequences: true
        }));

        // Второй LSTM слой
        newModel.add(tf.layers.lstm({
            units: 32
        }));

        // Dense слои
        newModel.add(tf.layers.dense({units: 16, activation: 'relu'}));
        newModel.add(tf.layers.dropout({rate: 0.3}));
        newModel.add(tf.layers.dense({units: 8, activation: 'relu'}));

        // Выходной слой
        newModel.add(tf.layers.dense({units: 1, activation: 'sigmoid'}));

        // Компиляция
        newModel.compile({
            optimizer: tf.train.adam(0.001),
            loss: 'binaryCrossentropy',
            metrics: ['accuracy']
        });

        model = newModel;
        console.log('Модель создана');
        addLog('LSTM модель создана', 'info', 'Архитектура: 64LSTM→32LSTM→16Dense→8Dense→1Output');
        return model;
    } catch (error) {
        console.error('Ошибка создания модели:', error);
        addLog('Ошибка создания модели', 'warning');
        return null;
    } finally {
        showLoader(false);
    }
}

function prepareInput(data) {
    if (data.length < CONFIG.LOOKBACK) return null;

    const sequence = data.slice(-CONFIG.LOOKBACK);
    const features = sequence.map(candle => [
        candle.close / 100000,
        candle.volume / 1000000,
        (candle.sma7 || candle.close) / 100000,
        (candle.rsi || 50) / 100,
        candle.change ? candle.change / 10 : 0,
        candle.volatility ? candle.volatility / 1000 : 0,
        Math.random() * 0.1,
        0
    ]);

    return tf.tensor3d([features]);
}

// Балансировка классов
function applyClassBalance(prediction) {
    const buyCount = experienceDB.decisions.filter(d => d.decision === 'BUY').length;
    const sellCount = experienceDB.decisions.filter(d => d.decision === 'SELL').length;
    const total = buyCount + sellCount;
    
    if (total < 10) return prediction;

    const currentRatio = buyCount / total;
    const imbalance = currentRatio - STRATEGY.classBalance.targetBuySellRatio;
    
    let adjustedProbability = prediction.probability;
    
    if (imbalance > 0.2) {
        if (prediction.decision === 'BUY') {
            adjustedProbability -= STRATEGY.classBalance.correctionFactor * imbalance;
        } else {
            adjustedProbability += STRATEGY.classBalance.correctionFactor * imbalance;
        }
    } else if (imbalance < -0.2) {
        if (prediction.decision === 'SELL') {
            adjustedProbability -= STRATEGY.classBalance.correctionFactor * Math.abs(imbalance);
        } else {
            adjustedProbability += STRATEGY.classBalance.correctionFactor * Math.abs(imbalance);
        }
    }
    
    adjustedProbability = Math.max(0.1, Math.min(0.9, adjustedProbability));
    
    return {
        ...prediction,
        probability: adjustedProbability,
        originalProbability: prediction.probability,
        classBalanceCorrection: imbalance
    };
}

// Анализ рыночных условий
function analyzeMarketContext() {
    if (state.priceData.length < 20) return { trend: 'unknown', volatility: 'unknown' };
    
    const recentData = state.priceData.slice(-50);
    const priceChanges = [];
    
    for (let i = 1; i < recentData.length; i++) {
        priceChanges.push((recentData[i].close - recentData[i-1].close) / recentData[i-1].close);
    }
    
    const avgChange = priceChanges.reduce((a, b) => a + b, 0) / priceChanges.length;
    const volatility = Math.sqrt(priceChanges.reduce((a, b) => a + Math.pow(b - avgChange, 2), 0) / priceChanges.length);
    
    const lastCandle = recentData[recentData.length - 1];
    const context = {
        trend: avgChange > 0.001 ? 'bullish' : avgChange < -0.001 ? 'bearish' : 'neutral',
        volatility: volatility > 0.02 ? 'high' : volatility < 0.005 ? 'low' : 'medium',
        rsiExtreme: lastCandle.rsi > 70 ? 'overbought' : lastCandle.rsi < 30 ? 'oversold' : 'normal',
        price: lastCandle.close,
        volume: lastCandle.volume > 1000000 ? 'high' : 'normal'
    };
    
    return context;
}

// Корректировка по рыночным условиям
function adjustForMarketConditions(prediction, marketContext) {
    let adjustment = 0;
    
    if (marketContext.rsiExtreme === 'overbought') {
        if (prediction.decision === 'BUY') adjustment -= 0.15;
        if (prediction.decision === 'SELL') adjustment += 0.1;
    } else if (marketContext.rsiExtreme === 'oversold') {
        if (prediction.decision === 'BUY') adjustment += 0.1;
        if (prediction.decision === 'SELL') adjustment -= 0.15;
    }
    
    if (marketContext.volatility === 'high') {
        adjustment -= 0.05;
    }
    
    if (marketContext.trend === 'bullish' && prediction.decision === 'SELL') {
        adjustment -= 0.1;
    } else if (marketContext.trend === 'bearish' && prediction.decision === 'BUY') {
        adjustment -= 0.1;
    }
    
    const adjustedProbability = Math.max(0.1, Math.min(0.9, prediction.probability + adjustment));
    
    return {
        ...prediction,
        probability: adjustedProbability,
        marketAdjustment: adjustment,
        marketContext: marketContext
    };
}

// Динамический порог
function applyDynamicThreshold(prediction) {
    const recentDecisions = experienceDB.decisions.slice(-20);
    const recentSuccesses = recentDecisions.filter(d => d.result === 'success').length;
    const recentTotal = recentDecisions.filter(d => d.result !== 'pending').length;
    const recentAccuracy = recentTotal > 0 ? recentSuccesses / recentTotal : 0.5;
    
    let dynamicThreshold = STRATEGY.dynamicThreshold.base;
    
    if (recentAccuracy < 0.4) {
        dynamicThreshold += STRATEGY.dynamicThreshold.adjustment;
    } else if (recentAccuracy > 0.7) {
        dynamicThreshold -= STRATEGY.dynamicThreshold.adjustment;
    }
    
    dynamicThreshold = Math.max(
        STRATEGY.dynamicThreshold.min,
        Math.min(STRATEGY.dynamicThreshold.max, dynamicThreshold)
    );
    
    const finalDecision = prediction.probability > dynamicThreshold ? 'BUY' : 'SELL';
    
    return {
        ...prediction,
        decision: finalDecision,
        dynamicThreshold: dynamicThreshold,
        thresholdCrossed: Math.abs(prediction.probability - dynamicThreshold)
    };
}

// Управление рисками
function applyRiskManagement(decision, marketContext) {
    const baseBetSize = parseFloat(document.getElementById('betSize').value) || CONFIG.DEFAULT_BET;
    let riskFactor = 1.0;
    
    if (marketContext.volatility === 'high') {
        riskFactor *= 0.5;
    }
    
    if (decision.probability < 0.6) {
        riskFactor *= 0.7;
    }
    
    const recentSuccessRate = getRecentSuccessRate(decision.decision);
    if (recentSuccessRate > 0.7) {
        riskFactor *= 1.2;
    } else if (recentSuccessRate < 0.3) {
        riskFactor *= 0.5;
    }
    
    riskFactor = Math.max(0.1, Math.min(2.0, riskFactor));
    const adjustedBetSize = baseBetSize * riskFactor;
    
    return {
        ...decision,
        adjustedBetSize: adjustedBetSize,
        riskFactor: riskFactor,
        adjustedConfidence: decision.probability * riskFactor
    };
}

function getRecentSuccessRate(decisionType) {
    const recent = experienceDB.decisions
        .filter(d => d.decision === decisionType && d.result !== 'pending')
        .slice(-10);
    
    if (recent.length === 0) return 0.5;
    
    const successes = recent.filter(d => d.result === 'success').length;
    return successes / recent.length;
}

// Улучшенная стратегия
function enhancedPredictionStrategy(prediction, marketContext) {
    const balancedPrediction = applyClassBalance(prediction);
    const marketAdjusted = adjustForMarketConditions(balancedPrediction, marketContext);
    const thresholdAdjusted = applyDynamicThreshold(marketAdjusted);
    const riskAdjusted = applyRiskManagement(thresholdAdjusted, marketContext);
    
    return {
        ...riskAdjusted,
        strategyUsed: {
            classBalanced: true,
            marketAdjusted: true,
            riskManaged: true,
            dynamicThreshold: true
        }
    };
}

// Использование опыта для принятия решений
function useExperienceForDecision(currentContext) {
    if (experienceDB.patterns.length === 0) return null;
    
    const similarPatterns = experienceDB.patterns.filter(pattern =>
        areContextsSimilar(pattern.marketContext, currentContext) &&
        pattern.successRate > 0.7
    );
    
    if (similarPatterns.length > 0) {
        similarPatterns.sort((a, b) => b.successRate - a.successRate);
        const bestPattern = similarPatterns[0];
        
        return {
            decision: bestPattern.decision,
            confidence: bestPattern.successRate,
            basedOnPattern: true,
            patternId: bestPattern.id,
            similarCases: bestPattern.occurrences
        };
    }
    
    return null;
}

function areContextsSimilar(context1, context2) {
    if (!context1 || !context2) return false;
    
    const similarityThreshold = 0.8;
    let matches = 0;
    let total = 0;
    
    for (const key in context1) {
        if (context2.hasOwnProperty(key)) {
            total++;
            if (context1[key] === context2[key]) {
                matches++;
            }
        }
    }
    
    return total > 0 && (matches / total) >= similarityThreshold;
}

// Сохранение опыта
function saveExperience(decision, result, marketContext) {
    const experience = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        decision: decision.decision,
        confidence: decision.probability,
        priceAtDecision: decision.price,
        priceAfter: result?.actualPrice || null,
        result: result ? (result.isCorrect ? 'success' : 'failure') : 'pending',
        profitLoss: result?.profit || 0,
        marketContext: marketContext,
        indicators: extractRelevantIndicators(),
        patternType: determinePatternType(decision, result)
    };
    
    experienceDB.decisions.push(experience);
    experienceDB.statistics.totalDecisions++;
    
    updateStatistics(experience);
    analyzeForPatterns(experience);
    persistExperience();
    visualizeExperienceUsage();
    
    return experience;
}

function determinePatternType(decision, result) {
    if (!result) return 'pending';
    
    if (decision.decision === 'BUY' && result.isCorrect) {
        return EXPERIENCE.PATTERN_TYPES.SUCCESSFUL_BUY;
    } else if (decision.decision === 'BUY' && !result.isCorrect) {
        return EXPERIENCE.PATTERN_TYPES.FAILED_BUY;
    } else if (decision.decision === 'SELL' && result.isCorrect) {
        return EXPERIENCE.PATTERN_TYPES.SUCCESSFUL_SELL;
    } else {
        return EXPERIENCE.PATTERN_TYPES.FAILED_SELL;
    }
}

function extractRelevantIndicators() {
    if (state.priceData.length === 0) return {};
    
    const lastCandle = state.priceData[state.priceData.length - 1];
    return {
        rsi: lastCandle.rsi,
        sma7: lastCandle.sma7,
        priceChange: lastCandle.change,
        volume: lastCandle.volume,
        volatility: lastCandle.volatility
    };
}

function updateStatistics(experience) {
    if (experience.result === 'success') {
        if (experience.decision === 'BUY') {
            experienceDB.statistics.successfulBuys++;
        } else {
            experienceDB.statistics.successfulSells++;
        }
    } else if (experience.result === 'failure') {
        if (experience.decision === 'BUY') {
            experienceDB.statistics.failedBuys++;
        } else {
            experienceDB.statistics.failedSells++;
        }
    }
}

function analyzeForPatterns(experience) {
    if (experience.result === 'success' && experienceDB.decisions.length >= 10) {
        const similarSuccesses = experienceDB.decisions.filter(d => 
            d.result === 'success' && 
            d.decision === experience.decision &&
            areContextsSimilar(d.marketContext, experience.marketContext)
        );
        
        if (similarSuccesses.length >= 3) {
            const totalSimilar = experienceDB.decisions.filter(d => 
                d.decision === experience.decision &&
                areContextsSimilar(d.marketContext, experience.marketContext)
            ).length;
            
            const successRate = similarSuccesses.length / totalSimilar;
            
            if (successRate > 0.7) {
                const pattern = {
                    id: Date.now(),
                    type: experience.patternType,
                    decision: experience.decision,
                    marketContext: experience.marketContext,
                    successRate: successRate,
                    occurrences: similarSuccesses.length,
                    lastSeen: experience.timestamp
                };
                
                const existingIndex = experienceDB.patterns.findIndex(p => 
                    p.decision === pattern.decision &&
                    JSON.stringify(p.marketContext) === JSON.stringify(pattern.marketContext)
                );
                
                if (existingIndex === -1) {
                    experienceDB.patterns.push(pattern);
                    addLog(`🎯 Обнаружен новый успешный паттерн: ${pattern.decision} (успешность: ${(successRate*100).toFixed(1)}%)`, 'info');
                } else {
                    experienceDB.patterns[existingIndex] = pattern;
                }
            }
        }
    }
}

// Загрузка опыта
function loadExperience() {
    console.log('Loading experience...');
    try {
        const saved = localStorage.getItem(EXPERIENCE.STORAGE_KEY);
        if (saved) {
            experienceDB = JSON.parse(saved);
            addLog(`📂 Загружена память обучения: ${experienceDB.decisions.length} решений, ${experienceDB.patterns.length} паттернов`, 'info');
            visualizeExperienceUsage();
        } else {
            console.log('No experience data found in localStorage');
        }
    } catch (error) {
        console.error('Ошибка загрузки опыта:', error);
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
    }
}

// Визуализация использования опыта
function visualizeExperienceUsage() {
    const experiencePanel = document.getElementById('experiencePanel');
    if (!experiencePanel) return;
    
    const total = experienceDB.decisions.length;
    const successful = experienceDB.decisions.filter(d => d.result === 'success').length;
    const successRate = total > 0 ? (successful / total * 100).toFixed(1) : 0;
    const patternsFound = experienceDB.patterns.length;
    
    const buyCount = experienceDB.decisions.filter(d => d.decision === 'BUY').length;
    const sellCount = experienceDB.decisions.filter(d => d.decision === 'SELL').length;
    const buySellRatio = buyCount > 0 ? (sellCount / buyCount).toFixed(2) : '0.00';
    
    experiencePanel.innerHTML = `
        <div class="card-title">
            <span>🧠</span> Память обучения
        </div>
        <div class="stats-grid">
            <div class="stat-item blue">
                <div class="stat-label">Всего решений</div>
                <div class="stat-value">${total}</div>
            </div>
            <div class="stat-item green">
                <div class="stat-label">Успешных</div>
                <div class="stat-value">${successful}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Успешность</div>
                <div class="stat-value">${successRate}%</div>
            </div>
            <div class="stat-item purple">
                <div class="stat-label">Паттернов</div>
                <div class="stat-value">${patternsFound}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">BUY/SELL</div>
                <div class="stat-value">${buySellRatio}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Опыт</div>
                <div class="stat-value">${experienceDB.memoryUsage > 0 ? ((experienceDB.memoryUsage/1024).toFixed(1)+'KB') : '0KB'}</div>
            </div>
        </div>
        <div class="progress-bar" style="margin-top: 15px;">
            <div class="progress-fill" style="width: ${(total / EXPERIENCE.MAX_MEMORY * 100)}%"></div>
        </div>
        <div style="font-size: 12px; color: #94a3b8; margin-top: 5px;">
            Заполнение памяти: ${total}/${EXPERIENCE.MAX_MEMORY} записей
        </div>
    `;
}

// Сохранение опыта
function persistExperience() {
    try {
        if (experienceDB.decisions.length > EXPERIENCE.MAX_MEMORY) {
            experienceDB.decisions = experienceDB.decisions.slice(-EXPERIENCE.MAX_MEMORY);
        }
        
        const jsonString = JSON.stringify(experienceDB);
        experienceDB.memoryUsage = new Blob([jsonString]).size;
        
        localStorage.setItem(EXPERIENCE.STORAGE_KEY, jsonString);
    } catch (error) {
        console.error('Ошибка сохранения опыта:', error);
    }
}

// Основная функция прогноза
async function makePrediction() {
    if (!model || state.priceData.length < CONFIG.LOOKBACK) {
        return null;
    }

    try {
        const input = prepareInput(state.priceData);
        if (!input) return null;

        const prediction = model.predict(input);
        const rawProbability = (await prediction.data())[0];

        const currentPrice = state.priceData[state.priceData.length - 1].close;
        
        const marketContext = analyzeMarketContext();
        
        const baseDecision = {
            time: Date.now(),
            price: currentPrice,
            probability: rawProbability,
            decision: rawProbability > 0.5 ? 'BUY' : 'SELL',
            result: null,
            features: state.priceData.slice(-1)[0],
            rawProbability: rawProbability
        };

        // Применяем улучшенную стратегию
        const enhancedDecision = enhancedPredictionStrategy(baseDecision, marketContext);
        
        // Проверяем, есть ли опыт для такого контекста
        const experienceAdvice = useExperienceForDecision(marketContext);
        if (experienceAdvice) {
            enhancedDecision.experienceBased = true;
            enhancedDecision.experienceConfidence = experienceAdvice.confidence;
            enhancedDecision.patternId = experienceAdvice.patternId;
        }
        
        input.dispose();
        prediction.dispose();

        const confidence = (enhancedDecision.probability * 100).toFixed(1);
        let confidenceLevel = "низкая";
        if (enhancedDecision.probability > 0.7) confidenceLevel = "высокая";
        else if (enhancedDecision.probability > 0.6) confidenceLevel = "средняя";

        addLog(`🧠 Нейросеть приняла решение: ${enhancedDecision.decision}`, 
              enhancedDecision.decision === 'BUY' ? 'profit' : 'loss',
              `Уверенность: ${confidence}% (${confidenceLevel}) | ` +
              `Цена: ${currentPrice.toFixed(2)} | ` +
              `${enhancedDecision.experienceBased ? '📚 На основе опыта' : '🎯 Новое решение'}`);

        return enhancedDecision;
    } catch (error) {
        console.error('Ошибка прогноза:', error);
        addLog('Ошибка при принятии решения', 'warning');
        return null;
    }
}

// Сохранение модели
async function saveModel() {
    showLoader(true, 'Сохранение модели...');
    try {
        if (model) {
            await model.save('localstorage://neuro-trader-model-v5');
        }
        
        localStorage.setItem(CONFIG.MODEL_KEY, JSON.stringify({
            balance: state.balance,
            predictions: state.predictions.slice(-100),
            balanceHistory: state.balanceHistory.slice(-50),
            accuracyHistory: state.accuracyHistory.slice(-50),
            confidenceHistory: state.confidenceHistory.slice(-50),
            savedAt: Date.now()
        }));
        
        addLog('Модель и данные сохранены', 'info', 'Нейросеть запомнила всё обучение');
        showNotification('Модель сохранена успешно', 'info');
    } catch (error) {
        console.error('Ошибка сохранения:', error);
        addLog('Ошибка сохранения модели', 'warning');
    } finally {
        showLoader(false);
    }
}

// Загрузка модели
async function loadModel() {
    showLoader(true, 'Загрузка модели...');
    try {
        const models = await tf.io.listModels();
        if (models['localstorage://neuro-trader-model-v5']) {
            model = await tf.loadLayersModel('localstorage://neuro-trader-model-v5');
            addLog('Модель загружена из памяти', 'info', 'Нейросеть вспомнила предыдущее обучение');
        } else {
            console.log('No saved model found');
        }
        
        const saved = localStorage.getItem(CONFIG.MODEL_KEY);
        if (saved) {
            const data = JSON.parse(saved);
            state.balance = data.balance || CONFIG.INITIAL_BALANCE;
            state.predictions = data.predictions || [];
            state.balanceHistory = data.balanceHistory || [{time: Date.now(), balance: state.balance}];
            state.accuracyHistory = data.accuracyHistory || [];
            state.confidenceHistory = data.confidenceHistory || [];
            
            updateUI();
            updateCharts();
            updateIndicatorsTable();
            
            addLog('Данные обучения загружены', 'info');
            showNotification('Модель загружена успешно', 'info');
        }
    } catch (error) {
        console.error('Ошибка загрузки:', error);
        addLog('Модель не найдена, создаем новую', 'warning');
    } finally {
        showLoader(false);
    }
}

// Функция для обновления списка паттернов (используется в app.js)
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
