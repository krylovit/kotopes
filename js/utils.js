// Утилиты
function showNotification(message, type = 'info', duration = 3000) {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.classList.add('show');

    setTimeout(() => notification.classList.remove('show'), duration);
}

function showLoader(show, text = 'Загрузка...') {
    const loader = document.getElementById('loader');
    const loaderText = document.getElementById('loaderText');

    if (show) {
        loaderText.textContent = text;
        loader.classList.add('active');
    } else {
        loader.classList.remove('active');
    }
}

function addLog(message, type = 'info') {
    const logContent = document.getElementById('logContent');
    const time = new Date().toLocaleTimeString();

    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.innerHTML = `
        <div class="log-time">${time}</div>
        <div class="log-message log-${type}">${message}</div>
    `;

    logContent.prepend(entry);

    // Ограничиваем лог
    if (logContent.children.length > 50) {
        logContent.removeChild(logContent.lastChild);
    }

    // Автопрокрутка
    logContent.scrollTop = 0;
}
