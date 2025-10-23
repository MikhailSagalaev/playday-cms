# PlayDay CMS

Система управления контентом для развлекательных центров - замена Make+Airtable+Collabza на собственное решение.

## 🎯 Описание

PlayDay CMS - это высокопроизводительная система управления контентом, разработанная специально для развлекательных центров. Заменяет платный стек Make+Airtable+Collabza на собственное решение с полным контролем над данными и логикой.

## ✨ Особенности

- **Высокая производительность**: Fastify в 2-3 раза быстрее Express
- **Полная интеграция с Tilda**: Совместимость с существующими скриптами
- **50+ полей данных**: Поддержка всех полей из Airtable
- **Система ролей**: Администратор, Редактор, Пользователь
- **Загрузка файлов**: Оптимизация изображений с помощью Sharp
- **Безопасность**: JWT аутентификация, валидация данных, CORS
- **Миграция данных**: Автоматический перенос из Airtable

## 🏗️ Архитектура

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Tilda Site    │    │  Fastify API    │    │   PostgreSQL    │
│                 │    │                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │ JS Script   │◄┼────┼►│ Auth Routes │ │    │ │ Users Table │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
│                 │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ ┌─────────────┐ │    │ │Location API │◄┼────┼►│Locations    │ │
│ │ HTML Forms  │◄┼────┼►│             │ │    │ │Table (50+   │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ │fields)      │ │
│                 │    │ ┌─────────────┐ │    │ └─────────────┘ │
│                 │    │ │ File Upload │ │    │ ┌─────────────┐ │
│                 │    │ │             │◄┼────┼►│ Files Table │ │
│                 │    │ └─────────────┘ │    │ └─────────────┘ │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🚀 Быстрый старт

### 1. Установка зависимостей

```bash
npm install
```

### 2. Настройка окружения

Скопируйте файл конфигурации:

```bash
cp env.example .env
```

Отредактируйте `.env` файл:

```env
# База данных
DATABASE_URL=postgresql://playday:password@localhost:5432/playday_cms
DB_HOST=localhost
DB_PORT=5432
DB_NAME=playday_cms
DB_USER=playday
DB_PASSWORD=your_secure_password_here

# JWT
JWT_SECRET=your_jwt_secret_key_here_minimum_32_characters
JWT_EXPIRES_IN=7d

# Сервер
PORT=3000
HOST=0.0.0.0
NODE_ENV=development

# CORS
CORS_ORIGIN=https://your-site.tilda.ws

# Airtable (для миграции)
AIRTABLE_API_KEY=your_airtable_api_key_here
AIRTABLE_BASE_ID=your_airtable_base_id_here
```

### 3. Настройка базы данных

```bash
# Создайте базу данных PostgreSQL
createdb playday_cms

# Создайте пользователя
psql -c "CREATE USER playday WITH PASSWORD 'your_password';"
psql -c "GRANT ALL PRIVILEGES ON DATABASE playday_cms TO playday;"
```

### 4. Выполнение миграций

```bash
npm run migrate
```

### 5. Миграция данных из Airtable

```bash
npm run migrate:airtable
```

### 6. Запуск сервера

```bash
# Разработка
npm run dev

# Продакшн
npm start
```

## 📚 API Документация

После запуска сервера документация доступна по адресу: `http://localhost:3000/docs`

### Основные endpoints:

#### Аутентификация
- `POST /api/auth/verify` - Проверка токена Tilda Members
- `GET /api/auth/profile` - Получение профиля пользователя
- `POST /api/auth/refresh` - Обновление токена
- `POST /api/auth/logout` - Выход из системы

#### Управление локациями
- `GET /api/locations` - Список локаций
- `GET /api/locations/:id` - Получение локации
- `POST /api/locations` - Создание локации
- `PUT /api/locations/:id` - Обновление локации
- `DELETE /api/locations/:id` - Удаление локации

#### Управление файлами
- `POST /api/files/upload` - Загрузка файла
- `GET /api/files/:filename` - Получение файла
- `DELETE /api/files/:filename` - Удаление файла
- `GET /api/files` - Список файлов

#### Интеграция с Tilda
- `POST /api/tilda/fetch-content` - Получение контента для Tilda
- `GET /api/tilda/health` - Проверка здоровья системы
- `POST /api/tilda/webhook` - Webhook для форм Tilda

## 🔧 Интеграция с Tilda

### 1. Замена скрипта Collabza

Замените содержимое HTML-блока Tilda на:

```html
<script src="https://your-api-domain.com/public/tilda-integration.js"></script>
```

### 2. Настройка CORS

Убедитесь, что в `.env` файле указан правильный домен Tilda:

```env
CORS_ORIGIN=https://your-site.tilda.ws
```

### 3. Настройка webhook форм

В настройках форм Tilda укажите URL webhook:

```
https://your-api-domain.com/api/tilda/webhook
```

## 🗄️ Структура базы данных

### Таблица `users`
```sql
id, tilda_user_id, email, role, created_at, updated_at
```

### Таблица `locations` (50+ полей)
```sql
-- Базовая информация
название_лк, название, описание, email, номер_телефона, картинка, адрес

-- Тайм-карты
тайм_карта_1_час, тайм_карта_2_часа, тайм_карта_3_часа, тайм_карта_4_часа, тайм_карта_5_часов

-- Призы
приз_1_текст, приз_1_картинка, приз_2_текст, приз_2_картинка, приз_3_текст, приз_3_картинка

-- Система лояльности
пополнение_1, бонус_1, пополнение_2, бонус_2, ...

-- Привилегии
накопление_1, привилегия_1, накопление_2, привилегия_2, ...
```

### Таблица `files`
```sql
id, location_id, filename, original_name, mime_type, size, path, field_name, created_at
```

## 🔒 Безопасность

- **JWT аутентификация** с истечением токенов
- **Валидация данных** через JSON Schema
- **Санитизация HTML** в описаниях
- **Rate limiting** для защиты от DDoS
- **CORS** для ограничения доступа
- **Проверка типов файлов** при загрузке
- **Логирование действий** пользователей

## 📊 Мониторинг

### PM2 (продакшн)

```bash
# Установка PM2
npm install -g pm2

# Запуск приложения
pm2 start src/app.js --name "playday-cms"

# Мониторинг
pm2 monit

# Логи
pm2 logs playday-cms
```

### Логирование

Логи сохраняются в директории `./logs/`:
- `app.log` - основные логи приложения
- `error.log` - ошибки
- `access.log` - HTTP запросы

## 🚀 Развертывание на VPS

### 1. Подготовка сервера

```bash
# Обновление системы
sudo apt update && sudo apt upgrade -y

# Установка Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Установка PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Установка Nginx
sudo apt install -y nginx

# Установка PM2
sudo npm install -g pm2
```

### 2. Настройка PostgreSQL

```bash
# Создание базы данных
sudo -u postgres psql
CREATE DATABASE playday_cms;
CREATE USER playday WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE playday_cms TO playday;
\q
```

### 3. Настройка Nginx

Создайте файл `/etc/nginx/sites-available/playday-api`:

```nginx
server {
    listen 80;
    server_name api.your-domain.com;

    client_max_body_size 10M;

    # CORS headers
    add_header 'Access-Control-Allow-Origin' 'https://your-site.tilda.ws' always;
    add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
    add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type' always;

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
    }

    # Static files
    location /uploads/ {
        alias /var/www/playday-cms/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

Активируйте конфигурацию:

```bash
sudo ln -s /etc/nginx/sites-available/playday-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 4. SSL сертификат

```bash
# Установка Certbot
sudo apt install -y certbot python3-certbot-nginx

# Получение сертификата
sudo certbot --nginx -d api.your-domain.com
```

### 5. Деплой приложения

```bash
# Клонирование репозитория
cd /var/www
git clone <your-repo> playday-cms
cd playday-cms

# Установка зависимостей
npm install --production

# Настройка окружения
cp env.example .env
nano .env

# Выполнение миграций
npm run migrate

# Миграция данных из Airtable
npm run migrate:airtable

# Запуск через PM2
pm2 start src/app.js --name "playday-cms"
pm2 startup
pm2 save
```

## 🧪 Тестирование

```bash
# Запуск тестов
npm test

# Тестирование в режиме наблюдения
npm run test:watch

# Линтинг кода
npm run lint
npm run lint:fix
```

## 📈 Производительность

### Бенчмарки Fastify vs Express

| Метрика | Fastify | Express | Улучшение |
|---------|---------|---------|-----------|
| Requests/sec | 15,000 | 5,000 | 3x |
| Memory usage | 50MB | 80MB | 37% меньше |
| Response time | 2ms | 6ms | 3x быстрее |

### Рекомендации по оптимизации

1. **Кэширование**: Используйте Redis для кэширования частых запросов
2. **CDN**: Настройте CDN для статических файлов
3. **Сжатие**: Включите gzip сжатие в Nginx
4. **Мониторинг**: Используйте PM2 для мониторинга производительности

## 🔄 Миграция с Airtable

### Автоматическая миграция

```bash
# Установите переменные окружения для Airtable
export AIRTABLE_API_KEY="your_api_key"
export AIRTABLE_BASE_ID="your_base_id"

# Запустите миграцию
npm run migrate:airtable
```

### Ручная миграция

1. Экспортируйте данные из Airtable в CSV
2. Импортируйте в PostgreSQL через pgAdmin
3. Обновите связи между таблицами

## 🆘 Устранение неполадок

### Частые проблемы

1. **Ошибка подключения к БД**
   - Проверьте настройки в `.env`
   - Убедитесь, что PostgreSQL запущен
   - Проверьте права пользователя

2. **CORS ошибки**
   - Проверьте настройку `CORS_ORIGIN` в `.env`
   - Убедитесь, что домен Tilda указан правильно

3. **Ошибки загрузки файлов**
   - Проверьте права на директорию `uploads/`
   - Убедитесь, что размер файла не превышает лимит

4. **Проблемы с Tilda**
   - Проверьте, что скрипт загружается
   - Убедитесь, что API доступен
   - Проверьте логи браузера

### Логи и отладка

```bash
# Просмотр логов PM2
pm2 logs playday-cms

# Просмотр логов Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Просмотр логов приложения
tail -f logs/app.log
```

## 📞 Поддержка

- **Документация API**: `http://your-domain.com/docs`
- **Логи ошибок**: `./logs/error.log`
- **Мониторинг**: PM2 dashboard

## 📄 Лицензия

MIT License - см. файл [LICENSE](LICENSE)

## 🤝 Вклад в проект

1. Fork репозитория
2. Создайте feature branch
3. Commit изменения
4. Push в branch
5. Создайте Pull Request

## 📝 Changelog

### v1.0.0
- Первоначальный релиз
- Полная замена Make+Airtable+Collabza
- Интеграция с Tilda
- Система ролей и прав
- Загрузка файлов
- Миграция данных из Airtable
