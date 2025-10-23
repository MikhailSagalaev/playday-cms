#!/bin/bash

# Скрипт настройки VPS для PlayDay CMS
# Использование: sudo bash scripts/setup-vps.sh

set -e

echo "🚀 Начинаем настройку VPS для PlayDay CMS..."

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Функция для вывода сообщений
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
}

# Проверяем, что скрипт запущен от root
if [ "$EUID" -ne 0 ]; then
    error "Пожалуйста, запустите скрипт с правами root: sudo bash scripts/setup-vps.sh"
    exit 1
fi

# 1. Обновление системы
log "Обновляем систему..."
apt update && apt upgrade -y

# 2. Установка необходимых пакетов
log "Устанавливаем базовые пакеты..."
apt install -y curl wget git unzip software-properties-common apt-transport-https ca-certificates gnupg lsb-release

# 3. Установка Node.js 18
log "Устанавливаем Node.js 18..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Проверяем версию Node.js
NODE_VERSION=$(node --version)
log "Node.js установлен: $NODE_VERSION"

# 4. Установка PostgreSQL
log "Устанавливаем PostgreSQL..."
apt install -y postgresql postgresql-contrib

# Запускаем и включаем автозапуск PostgreSQL
systemctl start postgresql
systemctl enable postgresql

# Проверяем статус PostgreSQL
if systemctl is-active --quiet postgresql; then
    log "PostgreSQL запущен успешно"
else
    error "Ошибка запуска PostgreSQL"
    exit 1
fi

# 5. Установка Nginx
log "Устанавливаем Nginx..."
apt install -y nginx

# Запускаем и включаем автозапуск Nginx
systemctl start nginx
systemctl enable nginx

# Проверяем статус Nginx
if systemctl is-active --quiet nginx; then
    log "Nginx запущен успешно"
else
    error "Ошибка запуска Nginx"
    exit 1
fi

# 6. Установка PM2
log "Устанавливаем PM2..."
npm install -g pm2

# Проверяем версию PM2
PM2_VERSION=$(pm2 --version)
log "PM2 установлен: $PM2_VERSION"

# 7. Настройка firewall
log "Настраиваем firewall..."
apt install -y ufw

# Разрешаем SSH, HTTP, HTTPS
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp

# Включаем firewall (интерактивно)
echo "y" | ufw enable

log "Firewall настроен"

# 8. Создание пользователя для приложения
log "Создаем пользователя playday..."
useradd -m -s /bin/bash playday || log "Пользователь playday уже существует"

# Добавляем пользователя в группу sudo
usermod -aG sudo playday

# 9. Настройка PostgreSQL
log "Настраиваем PostgreSQL..."

# Переключаемся на пользователя postgres для настройки БД
sudo -u postgres psql << EOF
-- Создаем базу данных
CREATE DATABASE playday_cms;

-- Создаем пользователя
CREATE USER playday WITH PASSWORD 'secure_password_change_me';

-- Даем права на базу данных
GRANT ALL PRIVILEGES ON DATABASE playday_cms TO playday;

-- Даем права на схему public
GRANT ALL ON SCHEMA public TO playday;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO playday;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO playday;

-- Настраиваем права по умолчанию
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO playday;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO playday;

\q
EOF

log "PostgreSQL настроен"

# 10. Создание директорий
log "Создаем директории для приложения..."
mkdir -p /opt/playday-cms
mkdir -p /opt/playday-cms/uploads
mkdir -p /opt/playday-cms/logs
mkdir -p /opt/playday-cms/backups

# Устанавливаем права
chown -R playday:playday /opt/playday-cms
chmod -R 755 /opt/playday-cms

log "Директории созданы"

# 11. Настройка Nginx
log "Настраиваем Nginx..."

# Создаем конфигурацию для PlayDay CMS
cat > /etc/nginx/sites-available/playday-api << 'EOF'
server {
    listen 80;
    server_name _;  # Замените на ваш домен
    
    # Ограничение размера загружаемых файлов
    client_max_body_size 10M;
    
    # CORS headers для Tilda
    add_header 'Access-Control-Allow-Origin' '*' always;
    add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
    add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type' always;
    
    # Обработка preflight запросов
    if ($request_method = 'OPTIONS') {
        add_header 'Access-Control-Allow-Origin' '*';
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS';
        add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type';
        add_header 'Access-Control-Max-Age' 1728000;
        add_header 'Content-Type' 'text/plain; charset=utf-8';
        add_header 'Content-Length' 0;
        return 204;
    }
    
    # API routes
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Статические файлы (загруженные изображения)
    location /uploads/ {
        alias /opt/playday-cms/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
        
        # Безопасность
        location ~* \.(php|pl|py|jsp|asp|sh|cgi)$ {
            deny all;
        }
    }
    
    # Документация API
    location /docs {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
    
    # Health check
    location /health {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
    
    # Безопасность
    location ~ /\. {
        deny all;
    }
    
    # Логи
    access_log /var/log/nginx/playday-api.access.log;
    error_log /var/log/nginx/playday-api.error.log;
}
EOF

# Активируем сайт
ln -sf /etc/nginx/sites-available/playday-api /etc/nginx/sites-enabled/

# Удаляем дефолтный сайт
rm -f /etc/nginx/sites-enabled/default

# Проверяем конфигурацию Nginx
nginx -t

# Перезагружаем Nginx
systemctl reload nginx

log "Nginx настроен"

# 12. Установка Certbot для SSL
log "Устанавливаем Certbot для SSL сертификатов..."
apt install -y certbot python3-certbot-nginx

log "Certbot установлен"

# 13. Настройка автоматических обновлений безопасности
log "Настраиваем автоматические обновления безопасности..."
apt install -y unattended-upgrades

cat > /etc/apt/apt.conf.d/50unattended-upgrades << 'EOF'
Unattended-Upgrade::Allowed-Origins {
    "${distro_id}:${distro_codename}-security";
    "${distro_id}ESMApps:${distro_codename}-apps-security";
    "${distro_id}ESM:${distro_codename}-infra-security";
};

Unattended-Upgrade::AutoFixInterruptedDpkg "true";
Unattended-Upgrade::MinimalSteps "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "false";
EOF

# 14. Настройка логирования
log "Настраиваем ротацию логов..."

cat > /etc/logrotate.d/playday-cms << 'EOF'
/var/www/playday-cms/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 playday playday
    postrotate
        pm2 reloadLogs
    endscript
}
EOF

# 15. Создание systemd сервиса для PM2
log "Создаем systemd сервис для PM2..."

cat > /etc/systemd/system/playday-cms.service << 'EOF'
[Unit]
Description=PlayDay CMS API
After=network.target

[Service]
Type=forking
User=playday
WorkingDirectory=/var/www/playday-cms
ExecStart=/usr/bin/pm2 start src/app.js --name playday-cms
ExecReload=/usr/bin/pm2 reload playday-cms
ExecStop=/usr/bin/pm2 stop playday-cms
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Перезагружаем systemd
systemctl daemon-reload

log "Systemd сервис создан"

# 16. Настройка мониторинга
log "Настраиваем базовый мониторинг..."

# Устанавливаем htop для мониторинга
apt install -y htop

# Создаем скрипт мониторинга
cat > /usr/local/bin/playday-monitor << 'EOF'
#!/bin/bash
echo "=== PlayDay CMS Status ==="
echo "Date: $(date)"
echo ""

echo "=== System Resources ==="
echo "CPU Usage:"
top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1
echo "Memory Usage:"
free -h
echo "Disk Usage:"
df -h /var/www/playday-cms
echo ""

echo "=== Services Status ==="
echo "Nginx: $(systemctl is-active nginx)"
echo "PostgreSQL: $(systemctl is-active postgresql)"
echo "PM2: $(pm2 status | grep playday-cms | awk '{print $10}')"
echo ""

echo "=== Application Logs (last 10 lines) ==="
tail -n 10 /var/www/playday-cms/logs/app.log 2>/dev/null || echo "No logs found"
echo ""

echo "=== Database Connections ==="
sudo -u postgres psql -c "SELECT count(*) as connections FROM pg_stat_activity WHERE datname='playday_cms';" 2>/dev/null || echo "Database not accessible"
EOF

chmod +x /usr/local/bin/playday-monitor

log "Мониторинг настроен"

# 17. Создание скрипта бэкапа
log "Создаем скрипт бэкапа..."

cat > /usr/local/bin/playday-backup << 'EOF'
#!/bin/bash
BACKUP_DIR="/var/www/playday-cms/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="playday_backup_$DATE"

echo "Создаем бэкап PlayDay CMS..."

# Создаем директорию бэкапа
mkdir -p $BACKUP_DIR

# Бэкап базы данных
sudo -u postgres pg_dump playday_cms > $BACKUP_DIR/${BACKUP_FILE}.sql

# Бэкап файлов
tar -czf $BACKUP_DIR/${BACKUP_FILE}_files.tar.gz -C /var/www/playday-cms uploads

# Бэкап конфигурации
tar -czf $BACKUP_DIR/${BACKUP_FILE}_config.tar.gz -C /var/www/playday-cms .env

# Удаляем старые бэкапы (старше 30 дней)
find $BACKUP_DIR -name "playday_backup_*" -mtime +30 -delete

echo "Бэкап создан: $BACKUP_DIR/${BACKUP_FILE}*"
EOF

chmod +x /usr/local/bin/playday-backup

# Добавляем в cron для ежедневного бэкапа
echo "0 2 * * * /usr/local/bin/playday-backup" | crontab -u playday -

log "Скрипт бэкапа создан"

# 18. Финальная проверка
log "Выполняем финальную проверку..."

# Проверяем статус всех сервисов
echo "=== Статус сервисов ==="
echo "Nginx: $(systemctl is-active nginx)"
echo "PostgreSQL: $(systemctl is-active postgresql)"
echo "Firewall: $(ufw status | head -1)"

# Проверяем порты
echo ""
echo "=== Открытые порты ==="
netstat -tlnp | grep -E ':(80|443|5432|3000)'

# Проверяем права на директории
echo ""
echo "=== Права на директории ==="
ls -la /var/www/playday-cms/

log "Настройка VPS завершена успешно!"
echo ""
echo "🎉 VPS готов к деплою PlayDay CMS!"
echo ""
echo "📋 Следующие шаги:"
echo "1. Скопируйте код приложения в /var/www/playday-cms/"
echo "2. Настройте .env файл"
echo "3. Выполните миграции базы данных"
echo "4. Запустите приложение через PM2"
echo "5. Настройте SSL сертификат"
echo ""
echo "🔧 Полезные команды:"
echo "- Мониторинг: /usr/local/bin/playday-monitor"
echo "- Бэкап: /usr/local/bin/playday-backup"
echo "- Логи: tail -f /var/www/playday-cms/logs/app.log"
echo "- PM2: pm2 status"
echo ""
echo "⚠️  Не забудьте:"
echo "- Изменить пароль PostgreSQL в .env файле"
echo "- Настроить домен в Nginx конфигурации"
echo "- Получить SSL сертификат"
