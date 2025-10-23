# 🚀 Финальные команды для сервера

## ✅ Код успешно запушен в GitHub!

Теперь выполните эти команды на сервере:

## 1. Клонирование и развертывание

```bash
# Переходим в /var/www
cd /var/www

# Клонируем репозиторий
git clone https://github.com/MikhailSagalaev/playday-cms.git

# Переходим в директорию проекта
cd playday-cms

# Делаем скрипты исполняемыми
chmod +x scripts/*.sh

# Запускаем полное развертывание
# Замените your-domain.com на ваш домен
sudo bash scripts/full-deploy.sh api.your-domain.com admin@your-domain.com
```

## 2. Настройка Airtable ключей

После развертывания добавьте реальные ключи Airtable:

```bash
# Открываем .env файл
sudo -u playday nano /var/www/playday-cms/.env

# Добавляем эти строки (замените на реальные значения):
AIRTABLE_API_KEY=your_airtable_api_key_here
AIRTABLE_BASE_ID=your_airtable_base_id_here
```

## 3. Миграция данных из Airtable

```bash
# Выполняем миграцию данных
sudo -u playday npm run migrate:airtable
```

## 4. Перезапуск приложения

```bash
# Перезапускаем с новыми настройками
pm2 restart playday-cms

# Проверяем статус
pm2 status
```

## 5. Проверка работы

```bash
# Проверяем здоровье системы
curl http://localhost:3000/health

# Если есть домен, проверяем через HTTPS
curl https://your-domain.com/health
```

## 6. Настройка Tilda

После успешного развертывания обновите скрипт в Tilda:

1. Откройте ваш сайт в Tilda
2. Найдите HTML-блок с Collabza скриптом
3. Замените содержимое на:

```html
<script src="https://your-domain.com/public/tilda-integration.js"></script>
```

## 7. Полезные команды

```bash
# Статус приложения
pm2 status

# Логи
pm2 logs playday-cms

# Мониторинг
pm2 monit

# Перезапуск
pm2 restart playday-cms

# Обновление кода
cd /var/www/playday-cms
git pull origin main
pm2 restart playday-cms
```

## 🎉 Готово!

После выполнения всех команд у вас будет полностью рабочая система PlayDay CMS, которая заменит Make+Airtable+Collabza и сэкономит ~$50-130/мес!
