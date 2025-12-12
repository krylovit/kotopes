// Система накопления опыта
const EXPERIENCE = {
    STORAGE_KEY: 'neuro_trader_experience_v1',
    MAX_MEMORY: 5000
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
        accuracyByMarketCondition: {}
    },
    memoryUsage: 0
};

// Загрузка опыта из localStorage
function loadExperience() {
    try {
        const saved = localStorage.getItem(EXPERIENCE.STORAGE_KEY);
        if (saved) {
            experienceDB = JSON.parse(saved);
            addLog(`Загружена память: ${experienceDB.decisions.length} решений, ${experienceDB.patterns.length} паттернов`, 'info');
        } else {
            console.log('Создаем новую базу опыта');
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
                    accuracyByMarketCondition: {}
                },
                memoryUsage: 0
            };
        }
        visualizeExperienceUsage();
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
                accuracyByMarketCondition: {}
            },
            memoryUsage: 0
        };
    }
}

// Сохранение опыта
function saveExperience(decision, result, marketContext) {
    if (!decision) return;
    
    const experience = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        decision: decision.decision,
        confidence: decision.probability || 0.5,
        priceAtDecision: decision.price,
        priceAfter: result?.actualPrice || null,
        result: result ? (result.isCorrect ? 'success' : 'failure') : 'pending',
        profitLoss: result?.profit || 0,
        marketContext: marketContext || {},
        betSize: result?.betSize || CONFIG.DEFAULT_BET
    };
    
    experienceDB.decisions.push(experience);
    experienceDB.statistics.totalDecisions++;
    
    // Обновляем статистику
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
    
    // Сохраняем в localStorage
    persistExperience();
    
    // Обновляем визуализацию
    visualizeExperienceUsage();
    
    return experience;
}

// Сохранение в localStorage
function persistExperience() {
    try {
        // Ограничиваем размер
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

// Визуализация использования опыта
function visualizeExperienceUsage() {
    const experiencePanel = document.getElementById('experiencePanel');
    if (!experiencePanel) return;
    
    const total = experienceDB.decisions.length;
    const successful = experienceDB.decisions.filter(d => d.result === 'success').length;
    const successRate = total > 0 ? (successful / total * 100).toFixed(1) : 0;
    
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
                <div class="stat-label">BUY/SELL</div>
                <div class="stat-value">${buyCount}/${sellCount}</div>
            </div>
        </div>
        <div class="progress-bar" style="margin-top: 15px;">
            <div class="progress-fill" style="width: ${Math.min((total / EXPERIENCE.MAX_MEMORY * 100), 100)}%"></div>
        </div>
        <div style="font-size: 12px; color: #94a3b8; margin-top: 5px;">
            Память: ${total}/${EXPERIENCE.MAX_MEMORY} записей
        </div>
    `;
}

// Использование опыта для принятия решений
function useExperienceForDecision(currentContext) {
    if (experienceDB.patterns.length === 0) return null;
    
    // Простая логика: находим похожие успешные решения
    const successfulDecisions = experienceDB.decisions
        .filter(d => d.result === 'success')
        .filter(d => {
            if (!d.marketContext || !currentContext) return false;
            // Простая проверка схожести
            const sameTrend = d.marketContext.trend === currentContext.trend;
            const sameVolatility = d.marketContext.volatility === currentContext.volatility;
            return sameTrend && sameVolatility;
        });
    
    if (successfulDecisions.length > 0) {
        const buyDecisions = successfulDecisions.filter(d => d.decision === 'BUY').length;
        const sellDecisions = successfulDecisions.filter(d => d.decision === 'SELL').length;
        
        if (buyDecisions > sellDecisions * 1.5) {
            return { decision: 'BUY', confidence: 0.7, basedOnPattern: true };
        } else if (sellDecisions > buyDecisions * 1.5) {
            return { decision: 'SELL', confidence: 0.7, basedOnPattern: true };
        }
    }
    
    return null;
}

// Обновление списка паттернов
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

    const recentPatterns = experienceDB.patterns.slice(-3);
    let html = '';
    
    recentPatterns.forEach(pattern => {
        const typeIcon = pattern.decision === 'BUY' ? '🟢' : '🔴';
        const successRate = pattern.successRate ? (pattern.successRate * 100).toFixed(1) : '0.0';
        
        html += `
            <div style="padding: 8px 12px; border-bottom: 1px solid #334155;">
                <div style="display: flex; justify-content: space-between;">
                    <span>${typeIcon} ${pattern.decision}</span>
                    <span style="color: #10b981;">${successRate}%</span>
                </div>
                <div style="font-size: 11px; color: #94a3b8;">
                    ${pattern.occurrences || 1} случаев
                </div>
            </div>
        `;
    });

    patternsList.innerHTML = html;
}

// Экспортируем функции
window.loadExperience = loadExperience;
window.saveExperience = saveExperience;
window.visualizeExperienceUsage = visualizeExperienceUsage;
window.useExperienceForDecision = useExperienceForDecision;
window.updatePatternsList = updatePatternsList;
window.experienceDB = experienceDB;
