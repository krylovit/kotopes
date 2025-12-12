// Система накопления и анализа опыта нейросети
const EXPERIENCE = {
    STORAGE_KEY: 'neuro_trader_experience_v1',
    MAX_MEMORY: 5000,
    
    // Типы паттернов
    PATTERN_TYPES: {
        SUCCESSFUL_BUY: 'successful_buy',
        FAILED_BUY: 'failed_buy',
        SUCCESSFUL_SELL: 'successful_sell',
        FAILED_SELL: 'failed_sell',
        MARKET_TREND: 'market_trend',
        VOLATILITY_SPIKE: 'volatility_spike'
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
        patternType: determinePatternType(decision, result),
        learningInsights: generateLearningInsights(decision, result)
    };
    
    experienceDB.decisions.push(experience);
    experienceDB.statistics.totalDecisions++;
    
    // Обновляем статистику
    updateStatistics(experience);
    
    // Ищем паттерны
    analyzeForPatterns(experience);
    
    // Сохраняем в localStorage
    persistExperience();
    
    // Визуализируем
    visualizeExperienceUsage();
    
    return experience;
}

// Определение типа паттерна
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

// Извлечение релевантных индикаторов
function extractRelevantIndicators() {
    if (state.priceData.length === 0) return {};
    
    const lastCandle = state.priceData[state.priceData.length - 1];
    return {
        rsi: lastCandle.rsi,
        sma7: lastCandle.sma7,
        sma20: lastCandle.sma20 || calculateSMA(20),
        priceChange: lastCandle.change,
        volume: lastCandle.volume,
        volatility: lastCandle.volatility,
        bollingerPosition: calculateBollingerPosition(),
        macdSignal: calculateMACDSignal(),
        marketPhase: determineMarketPhase()
    };
}

// Анализ рыночных условий
function analyzeMarketContext() {
    const recentData = state.priceData.slice(-50);
    if (recentData.length < 20) return 'unknown';
    
    // Анализируем тренд
    const priceChanges = [];
    for (let i = 1; i < recentData.length; i++) {
        priceChanges.push((recentData[i].close - recentData[i-1].close) / recentData[i-1].close);
    }
    
    const avgChange = priceChanges.reduce((a, b) => a + b, 0) / priceChanges.length;
    const volatility = Math.sqrt(priceChanges.reduce((a, b) => a + Math.pow(b - avgChange, 2), 0) / priceChanges.length);
    
    let context = {
        trend: avgChange > 0.001 ? 'bullish' : avgChange < -0.001 ? 'bearish' : 'neutral',
        volatility: volatility > 0.02 ? 'high' : volatility < 0.005 ? 'low' : 'medium',
        volumeTrend: analyzeVolumeTrend(recentData),
        rsiExtreme: recentData[recentData.length-1].rsi > 70 ? 'overbought' : 
                    recentData[recentData.length-1].rsi < 30 ? 'oversold' : 'normal'
    };
    
    return context;
}

// Обновление статистики
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
    
    // Обновляем точность по условиям рынка
    const marketKey = JSON.stringify(experience.marketContext);
    if (!experienceDB.statistics.accuracyByMarketCondition[marketKey]) {
        experienceDB.statistics.accuracyByMarketCondition[marketKey] = {
            total: 0,
            correct: 0
        };
    }
    
    experienceDB.statistics.accuracyByMarketCondition[marketKey].total++;
    if (experience.result === 'success') {
        experienceDB.statistics.accuracyByMarketCondition[marketKey].correct++;
    }
}

// Поиск паттернов
function analyzeForPatterns(experience) {
    // Ищем повторяющиеся успешные паттерны
    if (experience.result === 'success') {
        const similarSuccesses = experienceDB.decisions.filter(d => 
            d.result === 'success' && 
            d.decision === experience.decision &&
            areContextsSimilar(d.marketContext, experience.marketContext)
        );
        
        if (similarSuccesses.length >= 3) {
            const pattern = {
                type: experience.patternType,
                decision: experience.decision,
                marketContext: experience.marketContext,
                indicators: experience.indicators,
                successRate: similarSuccesses.length / 
                           experienceDB.decisions.filter(d => 
                               d.decision === experience.decision &&
                               areContextsSimilar(d.marketContext, experience.marketContext)
                           ).length,
                occurrences: similarSuccesses.length,
                lastSeen: experience.timestamp
            };
            
            // Проверяем, не существует ли уже такого паттерна
            const existingPattern = experienceDB.patterns.find(p => 
                p.decision === pattern.decision &&
                JSON.stringify(p.marketContext) === JSON.stringify(pattern.marketContext)
            );
            
            if (!existingPattern) {
                experienceDB.patterns.push(pattern);
                addLog(`🎯 Обнаружен новый успешный паттерн: ${pattern.decision} в условиях ${JSON.stringify(pattern.marketContext)}`, 'info');
            }
        }
    }
}

// Использование накопленного опыта
function useExperienceForDecision(currentContext) {
    if (experienceDB.patterns.length === 0) return null;
    
    // Ищем похожие успешные паттерны
    const similarPatterns = experienceDB.patterns.filter(pattern =>
        areContextsSimilar(pattern.marketContext, currentContext) &&
        pattern.successRate > 0.7
    );
    
    if (similarPatterns.length > 0) {
        // Сортируем по успешности
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

// Визуализация использования опыта
function visualizeExperienceUsage() {
    const experiencePanel = document.getElementById('experiencePanel');
    if (!experiencePanel) return;
    
    const total = experienceDB.decisions.length;
    const successful = experienceDB.decisions.filter(d => d.result === 'success').length;
    const successRate = total > 0 ? (successful / total * 100).toFixed(1) : 0;
    
    const patternsFound = experienceDB.patterns.length;
    const memoryUsage = (experienceDB.memoryUsage / (1024 * 1024)).toFixed(2); // MB
    
    experiencePanel.innerHTML = `
        <div class="card-title">
            <span>🧠</span> Память обучения (используется: ${memoryUsage} MB)
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
        </div>
        <div class="progress-bar" style="margin-top: 15px;">
            <div class="progress-fill" style="width: ${(total / EXPERIENCE.MAX_MEMORY * 100)}%"></div>
        </div>
        <div style="font-size: 12px; color: #94a3b8; margin-top: 5px;">
            Память обучения: ${total}/${EXPERIENCE.MAX_MEMORY} записей
        </div>
    `;
}

// Загрузка опыта
function loadExperience() {
    try {
        const saved = localStorage.getItem(EXPERIENCE.STORAGE_KEY);
        if (saved) {
            experienceDB = JSON.parse(saved);
            addLog(`📂 Загружена память обучения: ${experienceDB.decisions.length} решений, ${experienceDB.patterns.length} паттернов`, 'info');
            visualizeExperienceUsage();
        }
    } catch (error) {
        console.error('Ошибка загрузки опыта:', error);
    }
}

// Сохранение опыта
function persistExperience() {
    try {
        // Ограничиваем размер памяти
        if (experienceDB.decisions.length > EXPERIENCE.MAX_MEMORY) {
            experienceDB.decisions = experienceDB.decisions.slice(-EXPERIENCE.MAX_MEMORY);
        }
        
        // Рассчитываем использование памяти
        const jsonString = JSON.stringify(experienceDB);
        experienceDB.memoryUsage = new Blob([jsonString]).size;
        
        localStorage.setItem(EXPERIENCE.STORAGE_KEY, jsonString);
    } catch (error) {
        console.error('Ошибка сохранения опыта:', error);
    }
}

// Вспомогательные функции
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

function calculateSMA(period) {
    if (state.priceData.length < period) return null;
    
    const recent = state.priceData.slice(-period);
    const sum = recent.reduce((acc, candle) => acc + candle.close, 0);
    return sum / period;
}

function calculateBollingerPosition() {
    // Упрощенный расчет позиции относительно Bollinger Bands
    if (state.priceData.length < 20) return 'middle';
    
    const sma20 = calculateSMA(20);
    const recentPrices = state.priceData.slice(-20).map(c => c.close);
    const stdDev = Math.sqrt(
        recentPrices.reduce((acc, price) => acc + Math.pow(price - sma20, 2), 0) / 20
    );
    
    const upperBand = sma20 + (2 * stdDev);
    const lowerBand = sma20 - (2 * stdDev);
    const currentPrice = state.priceData[state.priceData.length - 1].close;
    
    if (currentPrice > upperBand) return 'upper';
    if (currentPrice < lowerBand) return 'lower';
    return 'middle';
}

function determineMarketPhase() {
    if (state.priceData.length < 50) return 'unknown';
    
    const recent50 = state.priceData.slice(-50);
    const priceChanges = [];
    
    for (let i = 1; i < recent50.length; i++) {
        priceChanges.push((recent50[i].close - recent50[i-1].close) / recent50[i-1].close);
    }
    
    const avgChange = priceChanges.reduce((a, b) => a + b, 0) / priceChanges.length;
    const volatility = Math.sqrt(priceChanges.reduce((a, b) => a + Math.pow(b - avgChange, 2), 0) / priceChanges.length);
    
    if (Math.abs(avgChange) < 0.001 && volatility < 0.01) return 'consolidation';
    if (avgChange > 0.002) return 'uptrend';
    if (avgChange < -0.002) return 'downtrend';
    if (volatility > 0.02) return 'volatile';
    
    return 'normal';
}