#!/bin/bash

# Скрипт деплоя PlayDay CMS на VPS
# Использование: bash scripts/deploy.sh [production|staging]

set -e

# Параметры
ENVIRONMENT=${1:-production}
APP_DIR="/opt/playday-cms"
BACKUP_DIR="/opt/playday-cms/backups"
LOG_FILE="/opt/playday-cms/logs/deploy.log"

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Функции для логирования
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" >> $LOG_FILE
}

warn() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1" >> $LOG_FILE
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1" >> $LOG_FILE
    exit 1
}

# Проверяем, что скрипт запущен от пользователя playday
if [ "$USER" != "playday" ]; then
    error "Пожалуйста, запустите скрипт от пользователя playday: su - playday"
fi

# Создаем директорию логов если не существует
mkdir -p $(dirname $LOG_FILE)

log "🚀 Начинаем деплой PlayDay CMS (среда: $ENVIRONMENT)"

# 1. Проверка зависимостей
log "Проверяем зависимости..."

# Проверяем Node.js
if ! command -v node &> /dev/null; then
    error "Node.js не установлен"
fi

NODE_VERSION=$(node --version)
log "Node.js: $NODE_VERSION"

# Проверяем PM2
if ! command -v pm2 &> /dev/null; then
    error "PM2 не установлен"
fi

PM2_VERSION=$(pm2 --version)
log "PM2: $PM2_VERSION"

# Проверяем PostgreSQL
if ! command -v psql &> /dev/null; then
    error "PostgreSQL не установлен"
fi

# 2. Создание бэкапа перед деплоем
log "Создаем бэкап перед деплоем..."
if [ -d "$APP_DIR" ] && [ -f "$APP_DIR/package.json" ]; then
    /usr/local/bin/playday-backup
    log "Бэкап создан"
else
    warn "Приложение не найдено, пропускаем бэкап"
fi

# 3. Остановка приложения
log "Останавливаем приложение..."
pm2 stop playday-cms 2>/dev/null || warn "Приложение не было запущено"
pm2 delete playday-cms 2>/dev/null || warn "Приложение не было найдено в PM2"

# 4. Переход в директорию приложения
cd $APP_DIR

# 5. Обновление кода (если это git репозиторий)
if [ -d ".git" ]; then
    log "Обновляем код из git..."
    git fetch origin
    git reset --hard origin/main
    log "Код обновлен"
else
    warn "Не git репозиторий, пропускаем обновление кода"
fi

# 6. Установка зависимостей
log "Устанавливаем зависимости..."
npm ci --production

if [ $? -ne 0 ]; then
    error "Ошибка установки зависимостей"
fi

log "Зависимости установлены"

# 7. Проверка конфигурации
log "Проверяем конфигурацию..."

# Проверяем .env файл
if [ ! -f ".env" ]; then
    error "Файл .env не найден. Скопируйте env.example в .env и настройте его"
fi

# Проверяем переменные окружения
source .env

if [ -z "$DATABASE_URL" ]; then
    error "DATABASE_URL не настроен в .env"
fi

if [ -z "$JWT_SECRET" ]; then
    error "JWT_SECRET не настроен в .env"
fi

log "Конфигурация проверена"

# 8. Выполнение миграций базы данных
log "Выполняем миграции базы данных..."
npm run migrate

if [ $? -ne 0 ]; then
    error "Ошибка выполнения миграций"
fi

log "Миграции выполнены"

# 9. Миграция данных из Airtable (если настроено)
if [ ! -z "$AIRTABLE_API_KEY" ] && [ ! -z "$AIRTABLE_BASE_ID" ]; then
    log "Мигрируем данные из Airtable..."
    npm run migrate:airtable
    
    if [ $? -ne 0 ]; then
        warn "Ошибка миграции данных из Airtable, продолжаем деплой"
    else
        log "Данные из Airtable мигрированы"
    fi
else
    warn "Airtable не настроен, пропускаем миграцию данных"
fi

# 10. Создание директорий
log "Создаем необходимые директории..."
mkdir -p uploads
mkdir -p logs
mkdir -p backups

# Устанавливаем права
chmod 755 uploads
chmod 755 logs
chmod 755 backups

log "Директории созданы"

# 11. Проверка подключения к базе данных
log "Проверяем подключение к базе данных..."
node -e "
const { testConnection } = require('./src/config/database');
testConnection().then(connected => {
    if (!connected) {
        console.error('Ошибка подключения к базе данных');
        process.exit(1);
    }
    console.log('Подключение к БД успешно');
}).catch(err => {
    console.error('Ошибка:', err.message);
    process.exit(1);
});
"

if [ $? -ne 0 ]; then
    error "Ошибка подключения к базе данных"
fi

log "Подключение к БД проверено"

# 12. Запуск приложения
log "Запускаем приложение..."
pm2 start src/app.js --name playday-cms --env $ENVIRONMENT

if [ $? -ne 0 ]; then
    error "Ошибка запуска приложения"
fi

# Ждем запуска приложения
sleep 5

# Проверяем статус
PM2_STATUS=$(pm2 jlist | jq -r '.[] | select(.name=="playday-cms") | .pm2_env.status' 2>/dev/null || echo "unknown")

if [ "$PM2_STATUS" != "online" ]; then
    error "Приложение не запустилось. Проверьте логи: pm2 logs playday-cms"
fi

log "Приложение запущено успешно"

# 13. Настройка автозапуска
log "Настраиваем автозапуск..."
pm2 save
pm2 startup systemd -u playday --hp /home/playday

log "Автозапуск настроен"

# 14. Проверка здоровья приложения
log "Проверяем здоровье приложения..."
sleep 10

# Проверяем HTTP ответ
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health || echo "000")

if [ "$HTTP_STATUS" = "200" ]; then
    log "Приложение отвечает на запросы"
else
    warn "Приложение не отвечает на HTTP запросы (статус: $HTTP_STATUS)"
fi

# 15. Проверка Nginx
log "Проверяем Nginx..."
if systemctl is-active --quiet nginx; then
    log "Nginx работает"
else
    warn "Nginx не работает"
fi

# 16. Финальная проверка
log "Выполняем финальную проверку..."

echo ""
echo "=== Статус приложения ==="
pm2 status

echo ""
echo "=== Использование ресурсов ==="
pm2 monit --no-daemon | head -20

echo ""
echo "=== Последние логи ==="
pm2 logs playday-cms --lines 10

# 17. Настройка SSL (если домен указан)
if [ ! -z "$DOMAIN" ] && [ "$DOMAIN" != "localhost" ]; then
    log "Настраиваем SSL сертификат для домена: $DOMAIN"
    
    # Обновляем конфигурацию Nginx с доменом
    sudo sed -i "s/server_name _;/server_name $DOMAIN;/" /etc/nginx/sites-available/playday-api
    
    # Перезагружаем Nginx
    sudo systemctl reload nginx
    
    # Получаем SSL сертификат
    sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN
    
    if [ $? -eq 0 ]; then
        log "SSL сертификат настроен"
    else
        warn "Ошибка настройки SSL сертификата"
    fi
else
    warn "Домен не указан, SSL не настроен"
fi

# 18. Создание скрипта быстрого деплоя
log "Создаем скрипт быстрого деплоя..."

cat > /usr/local/bin/playday-deploy << 'EOF'
#!/bin/bash
cd /var/www/playday-cms
bash scripts/deploy.sh production
EOF

chmod +x /usr/local/bin/playday-deploy

log "Скрипт быстрого деплоя создан: /usr/local/bin/playday-deploy"

# 19. Финальный отчет
log "🎉 Деплой завершен успешно!"

echo ""
echo "📊 Статистика деплоя:"
echo "- Среда: $ENVIRONMENT"
echo "- Директория: $APP_DIR"
echo "- PM2 статус: $(pm2 jlist | jq -r '.[] | select(.name=="playday-cms") | .pm2_env.status')"
echo "- HTTP статус: $HTTP_STATUS"
echo "- Время деплоя: $(date)"

echo ""
echo "🔧 Полезные команды:"
echo "- Статус: pm2 status"
echo "- Логи: pm2 logs playday-cms"
echo "- Мониторинг: /usr/local/bin/playday-monitor"
echo "- Бэкап: /usr/local/bin/playday-backup"
echo "- Перезапуск: pm2 restart playday-cms"
echo "- Быстрый деплой: /usr/local/bin/playday-deploy"

echo ""
echo "🌐 Доступ к приложению:"
echo "- API: http://localhost:3000"
echo "- Документация: http://localhost:3000/docs"
echo "- Health check: http://localhost:3000/health"

if [ ! -z "$DOMAIN" ] && [ "$DOMAIN" != "localhost" ]; then
    echo "- Внешний доступ: https://$DOMAIN"
fi

echo ""
echo "⚠️  Не забудьте:"
echo "- Настроить домен в Nginx если используете внешний домен"
echo "- Проверить настройки CORS для Tilda"
echo "- Настроить мониторинг и алерты"
echo "- Регулярно создавать бэкапы"

log "Деплой PlayDay CMS завершен!"
