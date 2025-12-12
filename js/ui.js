// Обновление интерфейса
function updateUI() {
    // Статус
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');

    statusDot.className = 'status-dot ' + state.status;
    statusText.textContent =
        state.status === 'running' ? 'Обучение' :
        state.status === 'paused' ? 'Пауза' : 'Остановлено';

    // Баланс и статистика
    document.getElementById('balanceValue').textContent = state.balance.toFixed(2);

    const profit = state.balance - CONFIG.INITIAL_BALANCE;
    document.getElementById('profitValue').textContent = (profit >= 0 ? '+' : '') + profit.toFixed(2);
    document.getElementById('profitValue').parentElement.className =
        'stat-item ' + (profit >= 0 ? 'green' : 'red');

    document.getElementById('predictionsCount').textContent = state.predictions.length;

    // Точность
    const recent = state.predictions.slice(-100);
    const correct = recent.filter(p => p.result && p.result.isCorrect).length;
    const accuracy = recent.length > 0 ? (correct / recent.length) * 100 : 0;
    document.getElementById('accuracyValue').textContent = accuracy.toFixed(1) + '%';

    // Таймер сессии
    if (state.sessionStart) {
        const elapsed = Date.now() - state.sessionStart;
        const hours = Math.floor(elapsed / 3600000);
        const minutes = Math.floor((elapsed % 3600000) / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        document.getElementById('sessionTimer').textContent =
            `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    // Прогресс обучения
    const progress = Math.min(state.predictions.length / 100 * 100, 100);
    document.getElementById('trainingProgress').style.width = progress + '%';
}
