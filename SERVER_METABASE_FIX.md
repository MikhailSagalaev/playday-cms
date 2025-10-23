# 🔧 Исправление Metabase

## Проблема: 502 Bad Gateway

Metabase запущен, но еще не готов или слушает неправильный порт.

## Проверка и исправление:

```bash
# 1. Проверьте логи Metabase - ждите сообщение "Metabase Initialization COMPLETE"
docker-compose logs -f metabase

# Дождитесь строки:
# "Metabase Initialization COMPLETE"

# 2. Проверьте, на каком порту слушает Metabase
sudo netstat -tlnp | grep 3000
sudo netstat -tlnp | grep 3001

# 3. Если Metabase слушает на 3000 (из-за network_mode: host), обновите Nginx:
sudo nano /etc/nginx/sites-available/playday-ip.conf

# Измените строку:
# proxy_pass http://localhost:3001/;
# На:
# proxy_pass http://localhost:3000/;

# 4. Перезагрузите Nginx:
sudo nginx -t
sudo systemctl reload nginx

# 5. Проверьте снова:
curl -I http://localhost/metabase/
```

## Альтернативное решение: Используйте прямой доступ по порту

Если не работает через Nginx, откройте порт в firewall и используйте прямой доступ:

```bash
# 1. Остановите текущий контейнер
cd /opt/metabase
docker-compose down

# 2. Отредактируйте docker-compose.yml
nano docker-compose.yml

# Удалите строку:
# network_mode: host

# И раскомментируйте (или добавьте если нет):
# ports:
#   - "3001:3000"

# 3. Запустите снова
docker-compose up -d

# 4. Откройте порт в firewall
sudo ufw allow 3001/tcp
sudo ufw status

# 5. Откройте в браузере:
# http://62.109.26.35:3001
```

## Быстрое решение (рекомендуется):

```bash
cd /opt/metabase

# Удалите network_mode: host из docker-compose.yml
sed -i '/network_mode: host/d' docker-compose.yml

# Пересоздайте контейнер
docker-compose down
docker-compose up -d

# Подождите 30-60 секунд
sleep 30

# Проверьте статус
docker-compose logs metabase | tail -20

# Откройте порт
sudo ufw allow 3001/tcp

# Теперь Metabase доступен на:
# http://62.109.26.35:3001 (прямой доступ)
# http://62.109.26.35/metabase (через Nginx, если исправили порт)
```

## Проверка подключения к PostgreSQL

Когда Metabase откроется, при настройке подключения к БД используйте:

**Если network_mode: host:**
- Host: `localhost`
- Port: `5432`

**Если БЕЗ network_mode: host:**
- Host: `172.17.0.1` (IP хоста в Docker bridge)
- Port: `5432`

Или:
- Host: `host.docker.internal`
- Port: `5432`
```
