# 🖥️ Полная настройка PlayDay CMS с нуля на чистом сервере

## 📋 Предварительные требования

- **ОС**: Ubuntu 20.04+ или Debian 11+
- **RAM**: минимум 2GB (рекомендуется 4GB+)
- **CPU**: минимум 1 ядро (рекомендуется 2+)
- **Диск**: минимум 20GB свободного места
- **Сеть**: статический IP адрес

## 🚀 Пошаговая настройка

### Шаг 1: Подключение к серверу

```bash
ssh root@YOUR_SERVER_IP
```

### Шаг 2: Обновление системы

```bash
# Обновляем систему
apt update && apt upgrade -y

# Устанавливаем необходимые пакеты
apt install -y curl wget git unzip software-properties-common apt-transport-https ca-certificates gnupg lsb-release
```

### Шаг 3: Установка Node.js 18

```bash
# Устанавливаем Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Проверяем версию
node --version
npm --version
```

### Шаг 4: Установка PostgreSQL

```bash
# Устанавливаем PostgreSQL
apt install -y postgresql postgresql-contrib

# Запускаем и включаем автозапуск
systemctl start postgresql
systemctl enable postgresql

# Проверяем статус
systemctl status postgresql
```

### Шаг 5: Настройка базы данных

```bash
# Переключаемся на пользователя postgres
sudo -u postgres psql

# В psql выполняем:
CREATE DATABASE playday_cms;
CREATE USER playday WITH PASSWORD 'secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE playday_cms TO playday;
GRANT ALL ON SCHEMA public TO playday;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO playday;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO playday;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO playday;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO playday;
\q
```

### Шаг 6: Установка Nginx

```bash
# Устанавливаем Nginx
apt install -y nginx

# Запускаем и включаем автозапуск
systemctl start nginx
systemctl enable nginx

# Проверяем статус
systemctl status nginx
```

### Шаг 7: Установка PM2

```bash
# Устанавливаем PM2 глобально
npm install -g pm2

# Проверяем версию
pm2 --version
```

### Шаг 8: Настройка firewall

```bash
# Устанавливаем UFW
apt install -y ufw

# Настраиваем правила
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp

# Включаем firewall
echo "y" | ufw enable

# Проверяем статус
ufw status
```

### Шаг 9: Создание пользователя для приложения

```bash
# Создаем пользователя playday
useradd -m -s /bin/bash playday

# Добавляем в группу sudo
usermod -aG sudo playday

# Создаем директории
mkdir -p /opt/playday-cms
mkdir -p /opt/playday-cms/uploads
mkdir -p /opt/playday-cms/logs
mkdir -p /opt/playday-cms/backups

# Устанавливаем права
chown -R playday:playday /opt/playday-cms
chmod -R 755 /opt/playday-cms
```

### Шаг 10: Клонирование приложения

```bash
# Переходим в директорию
cd /opt

# Клонируем репозиторий
git clone https://github.com/MikhailSagalaev/playday-cms.git

# Переходим в директорию проекта
cd playday-cms

# Устанавливаем права
chown -R playday:playday /opt/playday-cms
chmod -R 755 /opt/playday-cms

# Делаем скрипты исполняемыми
chmod +x scripts/*.sh
```

### Шаг 11: Настройка окружения

```bash
# Переключаемся на пользователя playday
sudo -u playday bash

# Переходим в директорию проекта
cd /opt/playday-cms

# Копируем файл окружения
cp env.example .env

# Редактируем .env файл
nano .env
```

### Шаг 12: Настройка .env файла

В файле `.env` обновите следующие параметры:

```env
# База данных
DATABASE_URL=postgresql://playday:secure_password_here@localhost:5432/playday_cms
DB_HOST=localhost
DB_PORT=5432
DB_NAME=playday_cms
DB_USER=playday
DB_PASSWORD=secure_password_here

# JWT секрет (сгенерируйте случайную строку)
JWT_SECRET=your_jwt_secret_key_here_minimum_32_characters
JWT_EXPIRES_IN=7d

# Сервер
PORT=3000
HOST=0.0.0.0
NODE_ENV=production

# CORS для Tilda (замените на ваш домен)
CORS_ORIGIN=https://your-site.tilda.ws
CORS_CREDENTIALS=true

# Настройки загрузки файлов
UPLOAD_DIR=/opt/playday-cms/uploads
MAX_FILE_SIZE=5242880
ALLOWED_MIME_TYPES=image/jpeg,image/png,image/gif,image/webp

# Airtable API (для миграции данных)
AIRTABLE_API_KEY=your_airtable_api_key_here
AIRTABLE_BASE_ID=your_airtable_base_id_here

# Логирование
LOG_LEVEL=info
LOG_FILE=/opt/playday-cms/logs/app.log

# Rate limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_TIME_WINDOW=60000
```

### Шаг 13: Установка зависимостей

```bash
# Устанавливаем зависимости
npm install --production

# Проверяем, что все установилось
npm list --depth=0
```

### Шаг 14: Выполнение миграций

```bash
# Выполняем миграции базы данных
npm run migrate

# Проверяем, что миграции выполнились
psql -h localhost -U playday -d playday_cms -c "\dt"
```

### Шаг 15: Миграция данных из Airtable

```bash
# Мигрируем данные из Airtable
npm run migrate:airtable

# Проверяем, что данные мигрировали
psql -h localhost -U playday -d playday_cms -c "SELECT COUNT(*) FROM locations;"
```

### Шаг 16: Настройка Nginx

```bash
# Выходим из пользователя playday
exit

# Создаем конфигурацию Nginx
cat > /etc/nginx/sites-available/playday-api << 'EOF'
server {
    listen 80;
    server_name api.your-domain.com;  # ЗАМЕНИТЕ НА ВАШ ДОМЕН
    
    # Ограничения безопасности
    client_max_body_size 10M;
    client_body_timeout 60s;
    client_header_timeout 60s;
    
    # CORS headers для Tilda
    add_header 'Access-Control-Allow-Origin' 'https://your-site.tilda.ws' always;
    add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
    add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type, X-Requested-With' always;
    add_header 'Access-Control-Allow-Credentials' 'true' always;
    
    # Обработка preflight запросов
    if ($request_method = 'OPTIONS') {
        add_header 'Access-Control-Allow-Origin' 'https://your-site.tilda.ws';
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS';
        add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type, X-Requested-With';
        add_header 'Access-Control-Allow-Credentials' 'true';
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
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Статические файлы
    location /uploads/ {
        alias /opt/playday-cms/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
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
}
EOF

# Активируем сайт
ln -s /etc/nginx/sites-available/playday-api /etc/nginx/sites-enabled/

# Удаляем дефолтный сайт
rm -f /etc/nginx/sites-enabled/default

# Проверяем конфигурацию
nginx -t

# Перезагружаем Nginx
systemctl reload nginx
```

### Шаг 17: Запуск приложения

```bash
# Переключаемся на пользователя playday
sudo -u playday bash

# Переходим в директорию проекта
cd /opt/playday-cms

# Запускаем приложение через PM2
pm2 start src/app.js --name playday-cms

# Настраиваем автозапуск
pm2 save
pm2 startup systemd -u playday --hp /home/playday

# Проверяем статус
pm2 status
```

### Шаг 18: Настройка SSL (если есть домен)

```bash
# Устанавливаем Certbot
apt install -y certbot python3-certbot-nginx

# Получаем SSL сертификат
certbot --nginx -d your-domain.com --non-interactive --agree-tos --email admin@your-domain.com

# Проверяем автообновление
certbot renew --dry-run
```

### Шаг 19: Создание скриптов управления

```bash
# Скрипт мониторинга
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
df -h /opt/playday-cms
echo ""
echo "=== Services Status ==="
echo "Nginx: $(systemctl is-active nginx)"
echo "PostgreSQL: $(systemctl is-active postgresql)"
echo "PM2: $(pm2 status | grep playday-cms | awk '{print $10}')"
echo ""
echo "=== Application Logs (last 10 lines) ==="
tail -n 10 /opt/playday-cms/logs/app.log 2>/dev/null || echo "No logs found"
EOF

chmod +x /usr/local/bin/playday-monitor

# Скрипт бэкапа
cat > /usr/local/bin/playday-backup << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/playday-cms/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="playday_backup_$DATE"

echo "Создаем бэкап PlayDay CMS..."

mkdir -p $BACKUP_DIR

# Бэкап базы данных
sudo -u postgres pg_dump playday_cms > $BACKUP_DIR/${BACKUP_FILE}.sql

# Бэкап файлов
tar -czf $BACKUP_DIR/${BACKUP_FILE}_files.tar.gz -C /opt/playday-cms uploads

# Бэкап конфигурации
tar -czf $BACKUP_DIR/${BACKUP_FILE}_config.tar.gz -C /opt/playday-cms .env

# Удаляем старые бэкапы (старше 30 дней)
find $BACKUP_DIR -name "playday_backup_*" -mtime +30 -delete

echo "Бэкап создан: $BACKUP_DIR/${BACKUP_FILE}*"
EOF

chmod +x /usr/local/bin/playday-backup

# Добавляем в cron для ежедневного бэкапа
echo "0 2 * * * /usr/local/bin/playday-backup" | crontab -u playday -
```

### Шаг 20: Финальная проверка

```bash
# Проверяем статус всех сервисов
echo "=== Статус сервисов ==="
echo "Nginx: $(systemctl is-active nginx)"
echo "PostgreSQL: $(systemctl is-active postgresql)"
echo "PM2: $(pm2 status | grep playday-cms | awk '{print $10}')"

# Проверяем порты
echo ""
echo "=== Открытые порты ==="
netstat -tlnp | grep -E ':(80|443|5432|3000)'

# Проверяем права на директории
echo ""
echo "=== Права на директории ==="
ls -la /opt/playday-cms/

# Тестируем API
echo ""
echo "=== Тестирование API ==="
curl -s http://localhost:3000/health | head -5
```

## 🎉 Готово!

После выполнения всех шагов у вас будет полностью рабочая система PlayDay CMS!

### 📊 Проверка работы:

```bash
# Статус приложения
pm2 status

# Логи
pm2 logs playday-cms

# Мониторинг
/usr/local/bin/playday-monitor

# Тестирование API
curl http://localhost:3000/health
```

### 🔧 Полезные команды:

```bash
# Перезапуск
pm2 restart playday-cms

# Обновление кода
cd /opt/playday-cms
git pull origin main
pm2 restart playday-cms

# Бэкап
/usr/local/bin/playday-backup

# Логи
tail -f /opt/playday-cms/logs/app.log
```

### 🌐 Доступ к приложению:

- **API**: `http://your-domain.com` или `http://localhost:3000`
- **Документация**: `http://your-domain.com/docs`
- **Health Check**: `http://your-domain.com/health`

### ⚠️ Важно:

1. Замените `your-domain.com` на ваш реальный домен
2. Замените `your-site.tilda.ws` на ваш домен Tilda
3. Настройте мониторинг и алерты
4. Регулярно создавайте бэкапы
5. Обновите скрипт в Tilda с новым API URL
