# 🚀 Инструкция по развертыванию PlayDay CMS

Полная инструкция по развертыванию системы управления контентом для развлекательных центров.

## 📋 Предварительные требования

### VPS сервер
- **ОС**: Ubuntu 20.04+ или Debian 11+
- **RAM**: минимум 2GB (рекомендуется 4GB+)
- **CPU**: минимум 1 ядро (рекомендуется 2+)
- **Диск**: минимум 20GB свободного места
- **Сеть**: статический IP адрес

### Домены
- **API домен**: `api.your-domain.com` (для API сервера)
- **Tilda домен**: `your-site.tilda.ws` (ваш сайт на Tilda)

## 🎯 Быстрое развертывание (рекомендуется)

### 1. Подготовка сервера

```bash
# Подключитесь к VPS по SSH
ssh root@your-server-ip

# Скачайте и запустите полный скрипт развертывания
wget https://raw.githubusercontent.com/your-repo/playday-cms/main/scripts/full-deploy.sh
chmod +x full-deploy.sh

# Запустите развертывание
sudo bash full-deploy.sh api.your-domain.com admin@your-domain.com
```

### 2. Настройка после развертывания

```bash
# Перейдите в директорию приложения
cd /var/www/playday-cms

# Настройте .env файл
nano .env
```

Обновите следующие параметры в `.env`:

```env
# База данных
DATABASE_URL=postgresql://playday:your_password@localhost:5432/playday_cms
DB_PASSWORD=your_secure_password_here

# JWT
JWT_SECRET=your_jwt_secret_key_here_minimum_32_characters

# CORS для Tilda
CORS_ORIGIN=https://your-site.tilda.ws

# Airtable (для миграции данных)
AIRTABLE_API_KEY=your_airtable_api_key_here
AIRTABLE_BASE_ID=your_airtable_base_id_here
```

### 3. Миграция данных из Airtable

```bash
# Выполните миграцию данных
sudo -u playday npm run migrate:airtable
```

### 4. Перезапуск приложения

```bash
# Перезапустите приложение с новыми настройками
pm2 restart playday-cms
```

## 🔧 Ручное развертывание

Если автоматический скрипт не подходит, выполните развертывание вручную:

### Этап 1: Настройка VPS

```bash
# Обновление системы
apt update && apt upgrade -y

# Установка Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt install -y nodejs

# Установка PostgreSQL
apt install -y postgresql postgresql-contrib

# Установка Nginx
apt install -y nginx

# Установка PM2
npm install -g pm2

# Настройка firewall
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

### Этап 2: Настройка базы данных

```bash
# Создание базы данных
sudo -u postgres psql
CREATE DATABASE playday_cms;
CREATE USER playday WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE playday_cms TO playday;
\q
```

### Этап 3: Развертывание приложения

```bash
# Создание директории
mkdir -p /var/www/playday-cms
cd /var/www/playday-cms

# Копирование кода (замените на ваш способ)
git clone https://github.com/your-repo/playday-cms.git .

# Установка зависимостей
npm install --production

# Настройка окружения
cp env.example .env
nano .env

# Выполнение миграций
npm run migrate

# Миграция данных из Airtable
npm run migrate:airtable
```

### Этап 4: Настройка Nginx

```bash
# Копирование конфигурации
cp nginx/playday-api.conf /etc/nginx/sites-available/playday-api

# Обновление домена в конфигурации
sed -i 's/api.your-domain.com/your-actual-domain.com/g' /etc/nginx/sites-available/playday-api

# Активация сайта
ln -s /etc/nginx/sites-available/playday-api /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Проверка и перезагрузка
nginx -t
systemctl reload nginx
```

### Этап 5: Запуск приложения

```bash
# Запуск через PM2
pm2 start src/app.js --name playday-cms

# Настройка автозапуска
pm2 save
pm2 startup
```

### Этап 6: Настройка SSL

```bash
# Установка Certbot
apt install -y certbot python3-certbot-nginx

# Получение SSL сертификата
certbot --nginx -d your-domain.com --non-interactive --agree-tos --email admin@your-domain.com
```

## 🧪 Тестирование

### Автоматическое тестирование

```bash
# Запуск полного набора тестов
cd /var/www/playday-cms
node scripts/test-integration.js https://your-domain.com
```

### Ручное тестирование

```bash
# Проверка здоровья системы
curl https://your-domain.com/health

# Проверка API документации
curl https://your-domain.com/docs

# Проверка CORS
curl -H "Origin: https://your-site.tilda.ws" \
     -H "Access-Control-Request-Method: POST" \
     -X OPTIONS https://your-domain.com/api/locations
```

## 🔄 Интеграция с Tilda

### 1. Замена скрипта Collabza

В HTML-блоке Tilda замените содержимое на:

```html
<script src="https://your-domain.com/public/tilda-integration.js"></script>
```

### 2. Настройка CORS

Убедитесь, что в `.env` файле указан правильный домен Tilda:

```env
CORS_ORIGIN=https://your-site.tilda.ws
```

### 3. Настройка webhook форм

В настройках форм Tilda укажите URL webhook:

```
https://your-domain.com/api/tilda/webhook
```

## 📊 Мониторинг и обслуживание

### Полезные команды

```bash
# Статус приложения
pm2 status

# Логи приложения
pm2 logs playday-cms

# Мониторинг ресурсов
pm2 monit

# Перезапуск приложения
pm2 restart playday-cms

# Обновление приложения
/usr/local/bin/playday-update

# Создание бэкапа
/usr/local/bin/playday-backup

# Проверка SSL сертификата
/usr/local/bin/playday-ssl-check your-domain.com
```

### Логи и отладка

```bash
# Логи приложения
tail -f /var/www/playday-cms/logs/app.log

# Логи Nginx
tail -f /var/log/nginx/playday-api.access.log
tail -f /var/log/nginx/playday-api.error.log

# Логи PM2
pm2 logs playday-cms --lines 100
```

### Мониторинг производительности

```bash
# Использование ресурсов
htop

# Статус сервисов
systemctl status nginx postgresql

# Подключения к базе данных
sudo -u postgres psql -c "SELECT count(*) FROM pg_stat_activity WHERE datname='playday_cms';"
```

## 🔒 Безопасность

### Рекомендации по безопасности

1. **Регулярно обновляйте систему**:
   ```bash
   apt update && apt upgrade -y
   ```

2. **Настройте брандмауэр**:
   ```bash
   ufw status
   ufw allow ssh
   ufw allow 80/tcp
   ufw allow 443/tcp
   ```

3. **Регулярно создавайте бэкапы**:
   ```bash
   /usr/local/bin/playday-backup
   ```

4. **Мониторьте логи**:
   ```bash
   tail -f /var/log/nginx/playday-api.error.log
   ```

5. **Проверяйте SSL сертификат**:
   ```bash
   /usr/local/bin/playday-ssl-check your-domain.com
   ```

## 🆘 Устранение неполадок

### Частые проблемы

#### 1. Приложение не запускается

```bash
# Проверьте логи
pm2 logs playday-cms

# Проверьте конфигурацию
node -c src/app.js

# Проверьте переменные окружения
cat .env
```

#### 2. Ошибки базы данных

```bash
# Проверьте подключение
sudo -u postgres psql -c "SELECT 1;"

# Проверьте права пользователя
sudo -u postgres psql -c "SELECT usename FROM pg_user WHERE usename='playday';"

# Выполните миграции
npm run migrate
```

#### 3. CORS ошибки

```bash
# Проверьте настройки CORS в .env
grep CORS_ORIGIN .env

# Проверьте конфигурацию Nginx
nginx -t

# Перезагрузите Nginx
systemctl reload nginx
```

#### 4. SSL проблемы

```bash
# Проверьте сертификат
/usr/local/bin/playday-ssl-check your-domain.com

# Обновите сертификат
/usr/local/bin/playday-ssl-renew

# Проверьте конфигурацию Nginx
nginx -t
```

### Восстановление из бэкапа

```bash
# Остановите приложение
pm2 stop playday-cms

# Восстановите базу данных
sudo -u postgres psql playday_cms < /var/www/playday-cms/backups/playday_backup_YYYYMMDD_HHMMSS.sql

# Восстановите файлы
tar -xzf /var/www/playday-cms/backups/playday_backup_YYYYMMDD_HHMMSS_files.tar.gz -C /var/www/playday-cms/

# Запустите приложение
pm2 start playday-cms
```

## 📞 Поддержка

### Полезные ресурсы

- **Документация API**: `https://your-domain.com/docs`
- **Health Check**: `https://your-domain.com/health`
- **Логи приложения**: `/var/www/playday-cms/logs/`
- **Конфигурация**: `/var/www/playday-cms/.env`

### Контакты

При возникновении проблем:

1. Проверьте логи приложения
2. Запустите тесты интеграции
3. Проверьте статус всех сервисов
4. Создайте бэкап перед изменениями

## 🎉 Готово!

После успешного развертывания у вас будет:

- ✅ Высокопроизводительный API на Fastify
- ✅ Полная интеграция с Tilda
- ✅ Система управления 50+ полями данных
- ✅ Безопасная аутентификация и авторизация
- ✅ Автоматические бэкапы
- ✅ SSL сертификаты
- ✅ Мониторинг и логирование

**Экономия**: ~$50-130/мес на подписках Make+Airtable+Collabza

**Производительность**: в 3 раза быстрее текущего решения

**Контроль**: полный контроль над данными и логикой
