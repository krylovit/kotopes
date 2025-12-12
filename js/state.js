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
    sessionStart: null,
    indicators: {},
    lastPrediction: null
};
