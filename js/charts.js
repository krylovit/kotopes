// Управление графиками
function updateCharts() {
    // График цены
    if (state.priceData.length > 0) {
        const priceCtx = document.getElementById('priceChart').getContext('2d');
        const labels = state.priceData.slice(-50).map(d =>
            new Date(d.time).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})
        );
        const prices = state.priceData.slice(-50).map(d => d.close);

        if (!charts.price) {
            charts.price = new Chart(priceCtx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Цена',
                        data: prices,
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        x: {
                            grid: { color: 'rgba(255,255,255,0.1)' },
                            ticks: { color: '#94a3b8', maxRotation: 0 }
                        },
                        y: {
                            grid: { color: 'rgba(255,255,255,0.1)' },
                            ticks: { color: '#94a3b8' }
                        }
                    }
                }
            });
        } else {
            charts.price.data.labels = labels;
            charts.price.data.datasets[0].data = prices;
            charts.price.update('none');
        }
    }

    // График баланса
    if (state.balanceHistory.length > 0) {
        const balanceCtx = document.getElementById('balanceChart').getContext('2d');
        const labels = state.balanceHistory.slice(-50).map(d =>
            new Date(d.time).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})
        );
        const balances = state.balanceHistory.slice(-50).map(d => d.balance);

        if (!charts.balance) {
            charts.balance = new Chart(balanceCtx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Баланс',
                        data: balances,
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        x: { display: false },
                        y: {
                            grid: { color: 'rgba(255,255,255,0.1)' },
                            ticks: { color: '#94a3b8' }
                        }
                    }
                }
            });
        } else {
            charts.balance.data.labels = labels;
            charts.balance.data.datasets[0].data = balances;
            charts.balance.update('none');
        }
    }

    // График точности
    if (state.accuracyHistory.length > 0) {
        const accuracyCtx = document.getElementById('accuracyChart').getContext('2d');
        const labels = state.accuracyHistory.slice(-50).map(d =>
            new Date(d.time).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})
        );
        const accuracies = state.accuracyHistory.slice(-50).map(d => d.accuracy);

        if (!charts.accuracy) {
            charts.accuracy = new Chart(accuracyCtx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Точность %',
                        data: accuracies,
                        borderColor: '#8b5cf6',
                        backgroundColor: 'rgba(139, 92, 246, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        x: { display: false },
                        y: {
                            min: 0,
                            max: 100,
                            grid: { color: 'rgba(255,255,255,0.1)' },
                            ticks: { color: '#94a3b8' }
                        }
                    }
                }
            });
        } else {
            charts.accuracy.data.labels = labels;
            charts.accuracy.data.datasets[0].data = accuracies;
            charts.accuracy.update('none');
        }
    }
}
