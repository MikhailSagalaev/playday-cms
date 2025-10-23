#!/bin/bash

# Полный скрипт развертывания PlayDay CMS
# Использование: sudo bash scripts/full-deploy.sh [domain] [email]

set -e

# Параметры
DOMAIN=${1:-""}
EMAIL=${2:-"admin@$DOMAIN"}
APP_DIR="/var/www/playday-cms"

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Функции для логирования
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

success() {
    echo -e "${GREEN}[SUCCESS] $1${NC}"
}

# Проверяем, что скрипт запущен от root
if [ "$EUID" -ne 0 ]; then
    error "Пожалуйста, запустите скрипт с правами root: sudo bash scripts/full-deploy.sh"
    exit 1
fi

# Заголовок
echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                    PlayDay CMS Deploy                        ║"
echo "║              Полное развертывание системы                   ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

log "🚀 Начинаем полное развертывание PlayDay CMS"

# 1. Настройка VPS
log "Этап 1: Настройка VPS..."
if [ -f "scripts/setup-vps.sh" ]; then
    bash scripts/setup-vps.sh
    if [ $? -eq 0 ]; then
        success "VPS настроен"
    else
        error "Ошибка настройки VPS"
        exit 1
    fi
else
    error "Скрипт настройки VPS не найден"
    exit 1
fi

# 2. Копирование приложения
log "Этап 2: Копирование приложения..."

# Создаем директорию если не существует
mkdir -p $APP_DIR

# Копируем файлы приложения
cp -r . $APP_DIR/
chown -R playday:playday $APP_DIR
chmod -R 755 $APP_DIR

success "Приложение скопировано"

# 3. Настройка окружения
log "Этап 3: Настройка окружения..."

# Переходим в директорию приложения
cd $APP_DIR

# Создаем .env файл если не существует
if [ ! -f ".env" ]; then
    if [ -f "env.example" ]; then
        cp env.example .env
        warn "Создан .env файл из примера. НЕ ЗАБУДЬТЕ НАСТРОИТЬ ЕГО!"
    else
        error "Файл env.example не найден"
        exit 1
    fi
fi

# Генерируем случайные пароли если не настроены
if ! grep -q "your_secure_password_here" .env; then
    DB_PASSWORD=$(openssl rand -base64 32)
    JWT_SECRET=$(openssl rand -base64 64)
    
    sed -i "s/your_secure_password_here/$DB_PASSWORD/g" .env
    sed -i "s/your_jwt_secret_key_here_minimum_32_characters/$JWT_SECRET/g" .env
    
    log "Сгенерированы случайные пароли"
fi

success "Окружение настроено"

# 4. Установка зависимостей
log "Этап 4: Установка зависимостей..."

# Переключаемся на пользователя playday
sudo -u playday bash -c "cd $APP_DIR && npm install --production"

if [ $? -eq 0 ]; then
    success "Зависимости установлены"
else
    error "Ошибка установки зависимостей"
    exit 1
fi

# 5. Настройка базы данных
log "Этап 5: Настройка базы данных..."

# Выполняем миграции
sudo -u playday bash -c "cd $APP_DIR && npm run migrate"

if [ $? -eq 0 ]; then
    success "Миграции выполнены"
else
    error "Ошибка выполнения миграций"
    exit 1
fi

# 6. Настройка Nginx
log "Этап 6: Настройка Nginx..."

# Копируем конфигурацию Nginx
if [ -f "nginx/playday-api.conf" ]; then
    cp nginx/playday-api.conf /etc/nginx/sites-available/playday-api
    
    # Обновляем домен если указан
    if [ ! -z "$DOMAIN" ]; then
        sed -i "s/api.your-domain.com/$DOMAIN/g" /etc/nginx/sites-available/playday-api
        sed -i "s/your-site.tilda.ws/https:\/\/your-site.tilda.ws/g" /etc/nginx/sites-available/playday-api
    fi
    
    # Активируем сайт
    ln -sf /etc/nginx/sites-available/playday-api /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    
    # Проверяем конфигурацию
    nginx -t
    systemctl reload nginx
    
    success "Nginx настроен"
else
    error "Конфигурация Nginx не найдена"
    exit 1
fi

# 7. Запуск приложения
log "Этап 7: Запуск приложения..."

# Переключаемся на пользователя playday и запускаем
sudo -u playday bash -c "cd $APP_DIR && pm2 start src/app.js --name playday-cms"

# Ждем запуска
sleep 5

# Проверяем статус
PM2_STATUS=$(pm2 jlist | jq -r '.[] | select(.name=="playday-cms") | .pm2_env.status' 2>/dev/null || echo "unknown")

if [ "$PM2_STATUS" = "online" ]; then
    success "Приложение запущено"
else
    error "Приложение не запустилось"
    pm2 logs playday-cms
    exit 1
fi

# 8. Настройка SSL (если домен указан)
if [ ! -z "$DOMAIN" ]; then
    log "Этап 8: Настройка SSL сертификата..."
    
    if [ -f "scripts/setup-ssl.sh" ]; then
        bash scripts/setup-ssl.sh $DOMAIN $EMAIL
        
        if [ $? -eq 0 ]; then
            success "SSL сертификат настроен"
        else
            warn "Ошибка настройки SSL сертификата"
        fi
    else
        warn "Скрипт настройки SSL не найден"
    fi
else
    warn "Домен не указан, SSL не настроен"
fi

# 9. Тестирование
log "Этап 9: Тестирование системы..."

# Устанавливаем зависимости для тестирования
sudo -u playday bash -c "cd $APP_DIR && npm install --save-dev axios form-data"

# Запускаем тесты
if [ -f "scripts/test-integration.js" ]; then
    API_URL="http://localhost:3000"
    if [ ! -z "$DOMAIN" ]; then
        API_URL="https://$DOMAIN"
    fi
    
    sudo -u playday bash -c "cd $APP_DIR && node scripts/test-integration.js $API_URL"
    
    if [ $? -eq 0 ]; then
        success "Тестирование пройдено"
    else
        warn "Некоторые тесты не прошли"
    fi
else
    warn "Скрипт тестирования не найден"
fi

# 10. Настройка мониторинга
log "Этап 10: Настройка мониторинга..."

# Настраиваем автозапуск PM2
sudo -u playday bash -c "cd $APP_DIR && pm2 save"
sudo -u playday bash -c "cd $APP_DIR && pm2 startup systemd -u playday --hp /home/playday"

# Создаем systemd сервис
cat > /etc/systemd/system/playday-cms.service << EOF
[Unit]
Description=PlayDay CMS API
After=network.target

[Service]
Type=forking
User=playday
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/pm2 start src/app.js --name playday-cms
ExecReload=/usr/bin/pm2 reload playday-cms
ExecStop=/usr/bin/pm2 stop playday-cms
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable playday-cms

success "Мониторинг настроен"

# 11. Финальная проверка
log "Этап 11: Финальная проверка..."

echo ""
echo "=== Статус сервисов ==="
echo "Nginx: $(systemctl is-active nginx)"
echo "PostgreSQL: $(systemctl is-active postgresql)"
echo "PM2: $(pm2 jlist | jq -r '.[] | select(.name=="playday-cms") | .pm2_env.status' 2>/dev/null || echo 'unknown')"

echo ""
echo "=== Использование ресурсов ==="
pm2 monit --no-daemon | head -10

echo ""
echo "=== Открытые порты ==="
netstat -tlnp | grep -E ':(80|443|5432|3000)'

echo ""
echo "=== Последние логи ==="
pm2 logs playday-cms --lines 5

# 12. Создание скриптов управления
log "Этап 12: Создание скриптов управления..."

# Скрипт быстрого деплоя
cat > /usr/local/bin/playday-deploy << 'EOF'
#!/bin/bash
cd /var/www/playday-cms
sudo -u playday bash scripts/deploy.sh production
EOF
chmod +x /usr/local/bin/playday-deploy

# Скрипт обновления
cat > /usr/local/bin/playday-update << 'EOF'
#!/bin/bash
cd /var/www/playday-cms
git pull origin main
sudo -u playday npm install --production
sudo -u playday npm run migrate
pm2 restart playday-cms
EOF
chmod +x /usr/local/bin/playday-update

# Скрипт бэкапа
cat > /usr/local/bin/playday-backup << 'EOF'
#!/bin/bash
/usr/local/bin/playday-backup
EOF
chmod +x /usr/local/bin/playday-backup

success "Скрипты управления созданы"

# 13. Финальный отчет
log "🎉 Развертывание PlayDay CMS завершено!"

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗"
echo -e "║                    РАЗВЕРТЫВАНИЕ ЗАВЕРШЕНО                    ║"
echo -e "╚══════════════════════════════════════════════════════════════╝${NC}"

echo ""
echo "📊 Статистика развертывания:"
echo "- Время: $(date)"
echo "- Домен: ${DOMAIN:-'не указан'}"
echo "- Директория: $APP_DIR"
echo "- Пользователь: playday"

echo ""
echo "🌐 Доступ к приложению:"
if [ ! -z "$DOMAIN" ]; then
    echo "- API: https://$DOMAIN"
    echo "- Документация: https://$DOMAIN/docs"
    echo "- Health Check: https://$DOMAIN/health"
else
    echo "- API: http://localhost:3000"
    echo "- Документация: http://localhost:3000/docs"
    echo "- Health Check: http://localhost:3000/health"
fi

echo ""
echo "🔧 Полезные команды:"
echo "- Статус: pm2 status"
echo "- Логи: pm2 logs playday-cms"
echo "- Мониторинг: /usr/local/bin/playday-monitor"
echo "- Бэкап: /usr/local/bin/playday-backup"
echo "- Деплой: /usr/local/bin/playday-deploy"
echo "- Обновление: /usr/local/bin/playday-update"

echo ""
echo "⚠️  Важные настройки:"
echo "1. Настройте .env файл с вашими данными"
echo "2. Обновите CORS настройки для вашего домена Tilda"
echo "3. Настройте мониторинг и алерты"
echo "4. Регулярно создавайте бэкапы"

if [ ! -z "$DOMAIN" ]; then
    echo ""
    echo "🔒 SSL сертификат:"
    echo "- Проверка: /usr/local/bin/playday-ssl-check $DOMAIN"
    echo "- Обновление: /usr/local/bin/playday-ssl-renew"
fi

echo ""
echo "📚 Документация:"
echo "- README: $APP_DIR/README.md"
echo "- API Docs: https://$DOMAIN/docs (если настроен SSL)"

echo ""
echo "🎯 Следующие шаги:"
echo "1. Настройте .env файл"
echo "2. Мигрируйте данные из Airtable (если нужно)"
echo "3. Обновите скрипт Tilda с новым API URL"
echo "4. Протестируйте интеграцию"

log "Развертывание PlayDay CMS завершено успешно!"
