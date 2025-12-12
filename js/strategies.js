// Улучшенная стратегия обучения с балансировкой
const STRATEGY = {
    // Динамический порог для принятия решений
    dynamicThreshold: {
        base: 0.5,
        adjustment: 0.1,
        min: 0.3,
        max: 0.7
    },
    
    // Балансировка классов
    classBalance: {
        targetBuySellRatio: 0.5, // Целевое соотношение BUY/SELL
        currentRatio: 1.0,
        correctionFactor: 0.05
    },
    
    // Адаптивное обучение
    adaptiveLearning: {
        lookbackAdjustment: true,
        featureWeighting: true,
        marketConditionAware: true
    }
};

// Основная стратегическая функция
function enhancedPredictionStrategy(prediction, marketContext) {
    const basePrediction = prediction;
    
    // 1. Используем накопленный опыт
    const experienceAdvice = useExperienceForDecision(marketContext);
    
    // 2. Балансируем классы (BUY/SELL)
    const balancedPrediction = applyClassBalance(basePrediction);
    
    // 3. Анализируем рыночные условия
    const marketAdjustedPrediction = adjustForMarketConditions(balancedPrediction, marketContext);
    
    // 4. Применяем динамический порог
    const finalDecision = applyDynamicThreshold(marketAdjustedPrediction);
    
    // 5. Управление рисками
    const riskAdjustedDecision = applyRiskManagement(finalDecision, marketContext);
    
    return {
        ...riskAdjustedDecision,
        strategyUsed: {
            experienceBased: !!experienceAdvice,
            classBalanced: true,
            marketAdjusted: true,
            riskManaged: true
        },
        confidenceFactors: {
            modelConfidence: prediction.probability,
            marketAlignment: calculateMarketAlignment(marketContext),
            experienceConfidence: experienceAdvice?.confidence || 0,
            riskAdjustedConfidence: riskAdjustedDecision.adjustedConfidence || prediction.probability
        }
    };
}

// Балансировка классов
function applyClassBalance(prediction) {
    const buyCount = experienceDB.decisions.filter(d => d.decision === 'BUY').length;
    const sellCount = experienceDB.decisions.filter(d => d.decision === 'SELL').length;
    const total = buyCount + sellCount;
    
    if (total < 10) return prediction; // Недостаточно данных
    
    const currentRatio = buyCount / total;
    const imbalance = currentRatio - STRATEGY.classBalance.targetBuySellRatio;
    
    // Корректируем вероятность в зависимости от дисбаланса
    let adjustedProbability = prediction.probability;
    
    if (imbalance > 0.2) { // Слишком много BUY
        if (prediction.decision === 'BUY') {
            adjustedProbability -= STRATEGY.classBalance.correctionFactor * imbalance;
        } else {
            adjustedProbability += STRATEGY.classBalance.correctionFactor * imbalance;
        }
    } else if (imbalance < -0.2) { // Слишком много SELL
        if (prediction.decision === 'SELL') {
            adjustedProbability -= STRATEGY.classBalance.correctionFactor * Math.abs(imbalance);
        } else {
            adjustedProbability += STRATEGY.classBalance.correctionFactor * Math.abs(imbalance);
        }
    }
    
    // Ограничиваем вероятность
    adjustedProbability = Math.max(0.1, Math.min(0.9, adjustedProbability));
    
    return {
        ...prediction,
        probability: adjustedProbability,
        originalProbability: prediction.probability,
        classBalanceCorrection: imbalance
    };
}

// Корректировка по рыночным условиям
function adjustForMarketConditions(prediction, marketContext) {
    let adjustment = 0;
    
    // Учитываем RSI
    if (marketContext.rsiExtreme === 'overbought') {
        if (prediction.decision === 'BUY') adjustment -= 0.15;
        if (prediction.decision === 'SELL') adjustment += 0.1;
    } else if (marketContext.rsiExtreme === 'oversold') {
        if (prediction.decision === 'BUY') adjustment += 0.1;
        if (prediction.decision === 'SELL') adjustment -= 0.15;
    }
    
    // Учитываем волатильность
    if (marketContext.volatility === 'high') {
        adjustment -= 0.05; // Снижаем уверенность при высокой волатильности
    }
    
    // Учитываем тренд
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

// Динамический порог принятия решений
function applyDynamicThreshold(prediction) {
    // Анализируем точность последних решений
    const recentDecisions = experienceDB.decisions.slice(-20);
    const recentAccuracy = recentDecisions.filter(d => d.result === 'success').length / 
                          Math.max(1, recentDecisions.filter(d => d.result !== 'pending').length);
    
    // Динамически корректируем порог
    let dynamicThreshold = STRATEGY.dynamicThreshold.base;
    
    if (recentAccuracy < 0.4) {
        dynamicThreshold += STRATEGY.dynamicThreshold.adjustment; // Повышаем требования
    } else if (recentAccuracy > 0.7) {
        dynamicThreshold -= STRATEGY.dynamicThreshold.adjustment; // Снижаем требования
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
    let adjustedBetSize = baseBetSize;
    
    // Уменьшаем ставку при высокой волатильности
    if (marketContext.volatility === 'high') {
        riskFactor *= 0.5;
    }
    
    // Уменьшаем ставку при низкой уверенности
    if (decision.probability < 0.6) {
        riskFactor *= 0.7;
    }
    
    // Увеличиваем ставку при подтверждении паттерном
    if (decision.strategyUsed?.experienceBased) {
        riskFactor *= 1.2;
    }
    
    // Ограничиваем максимальную ставку
    riskFactor = Math.max(0.1, Math.min(2.0, riskFactor));
    adjustedBetSize = baseBetSize * riskFactor;
    
    return {
        ...decision,
        adjustedBetSize: adjustedBetSize,
        riskFactor: riskFactor,
        adjustedConfidence: decision.probability * riskFactor
    };
}

// Расчет соответствия рынку
function calculateMarketAlignment(marketContext) {
    let alignment = 0.5;
    
    if (marketContext.trend === 'bullish') alignment += 0.2;
    if (marketContext.trend === 'bearish') alignment -= 0.2;
    if (marketContext.rsiExtreme === 'oversold') alignment += 0.1;
    if (marketContext.rsiExtreme === 'overbought') alignment -= 0.1;
    
    return Math.max(0, Math.min(1, alignment));
}

// Анализ объема
function analyzeVolumeTrend(recentData) {
    if (recentData.length < 10) return 'unknown';
    
    const volumes = recentData.map(d => d.volume);
    const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
    const currentVolume = recentData[recentData.length - 1].volume;
    
    if (currentVolume > avgVolume * 1.5) return 'increasing';
    if (currentVolume < avgVolume * 0.7) return 'decreasing';
    return 'stable';
}