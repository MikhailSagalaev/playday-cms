#!/bin/bash

# Скрипт настройки SSL сертификата для PlayDay CMS
# Использование: sudo bash scripts/setup-ssl.sh your-domain.com

set -e

# Параметры
DOMAIN=${1:-""}
EMAIL=${2:-"admin@$DOMAIN"}

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

# Проверяем параметры
if [ -z "$DOMAIN" ]; then
    error "Укажите домен: sudo bash scripts/setup-ssl.sh your-domain.com"
    exit 1
fi

# Проверяем, что скрипт запущен от root
if [ "$EUID" -ne 0 ]; then
    error "Пожалуйста, запустите скрипт с правами root: sudo bash scripts/setup-ssl.sh $DOMAIN"
    exit 1
fi

log "🔒 Настраиваем SSL сертификат для домена: $DOMAIN"

# 1. Проверяем, что домен указывает на сервер
log "Проверяем DNS настройки..."
DOMAIN_IP=$(dig +short $DOMAIN | tail -n1)
SERVER_IP=$(curl -s ifconfig.me)

if [ "$DOMAIN_IP" != "$SERVER_IP" ]; then
    warn "Домен $DOMAIN указывает на IP: $DOMAIN_IP"
    warn "IP сервера: $SERVER_IP"
    warn "Убедитесь, что DNS настроен правильно"
    read -p "Продолжить? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    log "DNS настроен правильно"
fi

# 2. Обновляем конфигурацию Nginx с доменом
log "Обновляем конфигурацию Nginx..."

# Создаем резервную копию
cp /etc/nginx/sites-available/playday-api /etc/nginx/sites-available/playday-api.backup

# Обновляем домен в конфигурации
sed -i "s/api.your-domain.com/$DOMAIN/g" /etc/nginx/sites-available/playday-api
sed -i "s/your-site.tilda.ws/https:\/\/your-site.tilda.ws/g" /etc/nginx/sites-available/playday-api

log "Конфигурация Nginx обновлена"

# 3. Проверяем конфигурацию Nginx
log "Проверяем конфигурацию Nginx..."
nginx -t

if [ $? -ne 0 ]; then
    error "Ошибка в конфигурации Nginx"
    exit 1
fi

# 4. Перезагружаем Nginx
log "Перезагружаем Nginx..."
systemctl reload nginx

log "Nginx перезагружен"

# 5. Получаем SSL сертификат
log "Получаем SSL сертификат от Let's Encrypt..."

# Проверяем, что Certbot установлен
if ! command -v certbot &> /dev/null; then
    error "Certbot не установлен. Установите его: apt install certbot python3-certbot-nginx"
    exit 1
fi

# Получаем сертификат
certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email $EMAIL --redirect

if [ $? -ne 0 ]; then
    error "Ошибка получения SSL сертификата"
    exit 1
fi

log "SSL сертификат получен"

# 6. Проверяем сертификат
log "Проверяем SSL сертификат..."
openssl x509 -in /etc/letsencrypt/live/$DOMAIN/cert.pem -text -noout | grep -E "(Subject:|Not Before|Not After)"

# 7. Настраиваем автообновление сертификата
log "Настраиваем автообновление сертификата..."

# Создаем скрипт для обновления
cat > /usr/local/bin/playday-ssl-renew << 'EOF'
#!/bin/bash
# Скрипт обновления SSL сертификата

echo "Обновляем SSL сертификат..."
certbot renew --quiet

if [ $? -eq 0 ]; then
    echo "SSL сертификат обновлен"
    systemctl reload nginx
    echo "Nginx перезагружен"
else
    echo "Ошибка обновления SSL сертификата"
    exit 1
fi
EOF

chmod +x /usr/local/bin/playday-ssl-renew

# Добавляем в cron для автоматического обновления
echo "0 2 * * * /usr/local/bin/playday-ssl-renew" | crontab -

log "Автообновление SSL настроено"

# 8. Настраиваем мониторинг SSL
log "Настраиваем мониторинг SSL..."

cat > /usr/local/bin/playday-ssl-check << 'EOF'
#!/bin/bash
# Скрипт проверки SSL сертификата

DOMAIN="$1"
if [ -z "$DOMAIN" ]; then
    echo "Использование: playday-ssl-check domain.com"
    exit 1
fi

echo "=== SSL Certificate Check for $DOMAIN ==="
echo ""

# Проверяем срок действия
EXPIRY_DATE=$(openssl s_client -servername $DOMAIN -connect $DOMAIN:443 2>/dev/null | openssl x509 -noout -dates | grep notAfter | cut -d= -f2)
EXPIRY_EPOCH=$(date -d "$EXPIRY_DATE" +%s)
CURRENT_EPOCH=$(date +%s)
DAYS_LEFT=$(( (EXPIRY_EPOCH - CURRENT_EPOCH) / 86400 ))

echo "Срок действия: $EXPIRY_DATE"
echo "Дней до истечения: $DAYS_LEFT"

if [ $DAYS_LEFT -lt 30 ]; then
    echo "⚠️  ВНИМАНИЕ: Сертификат истекает через $DAYS_LEFT дней!"
    echo "Запустите: /usr/local/bin/playday-ssl-renew"
else
    echo "✅ Сертификат действителен еще $DAYS_LEFT дней"
fi

echo ""
echo "=== SSL Configuration ==="
openssl s_client -servername $DOMAIN -connect $DOMAIN:443 -showcerts < /dev/null 2>/dev/null | openssl x509 -noout -text | grep -E "(Subject:|Issuer:|Not Before|Not After|Signature Algorithm|Public Key Algorithm)"
EOF

chmod +x /usr/local/bin/playday-ssl-check

log "Мониторинг SSL настроен"

# 9. Тестируем SSL
log "Тестируем SSL соединение..."

# Проверяем HTTP редирект
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://$DOMAIN)
if [ "$HTTP_STATUS" = "301" ] || [ "$HTTP_STATUS" = "302" ]; then
    log "HTTP редирект на HTTPS работает"
else
    warn "HTTP редирект не работает (статус: $HTTP_STATUS)"
fi

# Проверяем HTTPS
HTTPS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://$DOMAIN)
if [ "$HTTPS_STATUS" = "200" ]; then
    log "HTTPS работает"
else
    warn "HTTPS не работает (статус: $HTTPS_STATUS)"
fi

# Проверяем API
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://$DOMAIN/api/health)
if [ "$API_STATUS" = "200" ]; then
    log "API доступен через HTTPS"
else
    warn "API недоступен через HTTPS (статус: $API_STATUS)"
fi

# 10. Финальная проверка
log "Выполняем финальную проверку..."

echo ""
echo "=== SSL Configuration Summary ==="
echo "Домен: $DOMAIN"
echo "Email: $EMAIL"
echo "Сертификат: /etc/letsencrypt/live/$DOMAIN/"
echo "Конфигурация: /etc/nginx/sites-available/playday-api"
echo ""

echo "=== SSL Certificate Info ==="
/usr/local/bin/playday-ssl-check $DOMAIN

echo ""
echo "=== Test URLs ==="
echo "HTTP: http://$DOMAIN (должен редиректить на HTTPS)"
echo "HTTPS: https://$DOMAIN"
echo "API: https://$DOMAIN/api/health"
echo "Docs: https://$DOMAIN/docs"

echo ""
echo "=== Useful Commands ==="
echo "Проверка SSL: /usr/local/bin/playday-ssl-check $DOMAIN"
echo "Обновление SSL: /usr/local/bin/playday-ssl-renew"
echo "Проверка Nginx: nginx -t"
echo "Перезагрузка Nginx: systemctl reload nginx"

# 11. Настройка безопасности
log "Настраиваем дополнительные меры безопасности..."

# Создаем конфигурацию для дополнительной безопасности
cat > /etc/nginx/snippets/ssl-security.conf << 'EOF'
# Дополнительные настройки безопасности SSL

# Отключение старых протоколов
ssl_protocols TLSv1.2 TLSv1.3;

# Современные шифры
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;

# Настройки сессий
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 10m;
ssl_session_tickets off;

# OCSP Stapling
ssl_stapling on;
ssl_stapling_verify on;
ssl_trusted_certificate /etc/letsencrypt/live/your-domain.com/chain.pem;

# Дополнительные заголовки безопасности
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
EOF

log "Дополнительные настройки безопасности созданы"

log "🎉 SSL сертификат настроен успешно!"

echo ""
echo "📋 Следующие шаги:"
echo "1. Обновите CORS настройки в .env файле с вашим доменом Tilda"
echo "2. Протестируйте API через HTTPS"
echo "3. Настройте мониторинг SSL сертификата"
echo "4. Обновите скрипт Tilda с новым HTTPS URL"

echo ""
echo "⚠️  Важно:"
echo "- SSL сертификат будет автоматически обновляться"
echo "- Проверяйте срок действия: /usr/local/bin/playday-ssl-check $DOMAIN"
echo "- При проблемах запустите: /usr/local/bin/playday-ssl-renew"

log "Настройка SSL завершена!"
