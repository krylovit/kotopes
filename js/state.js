// Глобальное состояние приложения
let model = null;
let charts = {};
let state = {
    status: 'stopped', // 'running', 'paused', 'stopped'
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
