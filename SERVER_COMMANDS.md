# 🖥️ Команды для выполнения на сервере

## Шаг 1: Клонирование и подготовка

```bash
# Переходим в директорию /var/www
cd /var/www

# Клонируем репозиторий (замените YOUR_USERNAME на ваш GitHub username)
git clone https://github.com/YOUR_USERNAME/playday-cms.git

# Переходим в директорию проекта
cd playday-cms

# Делаем скрипты исполняемыми
chmod +x scripts/*.sh
```

## Шаг 2: Полное автоматическое развертывание

```bash
# Запускаем полный скрипт развертывания
# Замените your-domain.com на ваш домен
sudo bash scripts/full-deploy.sh api.your-domain.com admin@your-domain.com
```

## Шаг 3: Настройка после развертывания

```bash
# Переходим в директорию приложения
cd /var/www/playday-cms

# Настраиваем .env файл
sudo -u playday nano .env
```

### Обязательно обновите в .env файле:

```env
# База данных (пароль будет сгенерирован автоматически)
DATABASE_URL=postgresql://playday:сгенерированный_пароль@localhost:5432/playday_cms

# JWT секрет (будет сгенерирован автоматически)
JWT_SECRET=сгенерированный_секрет

# CORS для вашего сайта Tilda
CORS_ORIGIN=https://your-site.tilda.ws

# Airtable API (для миграции данных)
AIRTABLE_API_KEY=your_airtable_api_key_here
AIRTABLE_BASE_ID=your_airtable_base_id_here
```

## Шаг 4: Миграция данных из Airtable

```bash
# Выполняем миграцию данных
sudo -u playday npm run migrate:airtable
```

## Шаг 5: Перезапуск приложения

```bash
# Перезапускаем с новыми настройками
pm2 restart playday-cms

# Проверяем статус
pm2 status
```

## Шаг 6: Проверка работы

```bash
# Проверяем здоровье системы
curl http://localhost:3000/health

# Проверяем логи
pm2 logs playday-cms

# Если есть домен, проверяем через HTTPS
curl https://your-domain.com/health
```

## Шаг 7: Настройка Tilda

После успешного развертывания обновите скрипт в Tilda:

1. Откройте ваш сайт в Tilda
2. Найдите HTML-блок с Collabza скриптом
3. Замените содержимое на:

```html
<script src="https://your-domain.com/public/tilda-integration.js"></script>
```

## Полезные команды для управления

```bash
# Статус приложения
pm2 status

# Логи в реальном времени
pm2 logs playday-cms --lines 50

# Перезапуск
pm2 restart playday-cms

# Мониторинг ресурсов
pm2 monit

# Обновление кода
cd /var/www/playday-cms
git pull origin main
pm2 restart playday-cms

# Создание бэкапа
/usr/local/bin/playday-backup

# Проверка SSL (если настроен)
/usr/local/bin/playday-ssl-check your-domain.com
```

## Проверка развертывания

После выполнения всех команд проверьте:

1. **API работает**: `curl http://localhost:3000/health`
2. **База данных подключена**: в ответе должно быть `"database": "connected"`
3. **PM2 запущен**: `pm2 status` показывает `online`
4. **Nginx работает**: `systemctl status nginx`
5. **SSL настроен** (если есть домен): `curl https://your-domain.com/health`

## В случае проблем

```bash
# Проверьте логи
pm2 logs playday-cms
tail -f /var/www/playday-cms/logs/app.log

# Проверьте конфигурацию
nginx -t

# Перезапустите сервисы
systemctl restart nginx
pm2 restart playday-cms
```
