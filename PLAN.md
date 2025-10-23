# План миграции системы управления контентом развлекательных центров

## Обзор проекта

Миграция с платного стека **Make + Airtable + Collabza** на собственное решение на базе **Node.js + Fastify + PostgreSQL** с развертыванием на VPS. Система управляет контентом для нескольких филиалов развлекательных центров с комплексной структурой данных (50+ полей).

## Текущая архитектура (что заменяем)

**Цепочка обработки:**
1. Пользователь заполняет форму в личном кабинете на Tilda
2. Webhook → Make (обработка данных)
3. Make → Airtable (хранение данных)
4. Collabza скрипт на Tilda запрашивает данные из Airtable
5. JavaScript динамически заполняет страницы

**Проблемы:**
- Ежемесячные затраты: ~$50-130
- Зависимость от 3 сторонних сервисов
- Низкая скорость (цепочка запросов)
- Ограниченный контроль

## Новая архитектура

### Backend: Node.js + Fastify

**Почему Fastify:**
- В 2-3 раза быстрее Express
- Встроенная валидация через JSON Schema
- Низкое потребление RAM (~50-80MB)
- Async/await из коробки
- Отличная производительность для API

### База данных: PostgreSQL

**Структура данных (50+ полей):**

**Таблица `users`:**
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  tilda_user_id VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'user', -- user, editor, admin
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Таблица `locations` (основная таблица контента):**
```sql
CREATE TABLE locations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  record_id VARCHAR(50) UNIQUE, -- для совместимости с Airtable
  
  -- Базовая информация
  название_лк VARCHAR(255),
  название VARCHAR(500),
  описание TEXT,
  email VARCHAR(255),
  номер_телефона VARCHAR(50),
  картинка VARCHAR(500),
  адрес TEXT,
  
  -- Тайм-карты (цены на игровое время)
  тайм_карта_1_час INTEGER,
  тайм_карта_2_часа INTEGER,
  тайм_карта_3_часа INTEGER,
  тайм_карта_4_часа INTEGER,
  тайм_карта_5_часов INTEGER,
  
  -- Призы для розыгрышей
  приз_1_текст TEXT,
  приз_1_картинка VARCHAR(500),
  приз_2_текст TEXT,
  приз_2_картинка VARCHAR(500),
  приз_3_текст TEXT,
  приз_3_картинка VARCHAR(500),
  призы_текст TEXT,
  розыгрыш_тайм_карт_текст TEXT,
  пополнить_карту_сумма INTEGER,
  дата_следующего_розыгрыша VARCHAR(100),
  
  -- Акции и скидки
  заголовок_четверг_по_30 VARCHAR(50),
  каждый_четверг_текст TEXT,
  скидка_1 VARCHAR(50),
  скидка_2 VARCHAR(50),
  
  -- Тайм-карты (реальные цены)
  тайм_карта_1_час_цена INTEGER,
  тайм_карта_2_часа_цена INTEGER,
  тайм_карта_3_часа_цена INTEGER,
  тайм_карта_4_часа_цена INTEGER,
  тайм_карта_5_часов_цена INTEGER,
  
  -- Система лояльности: Пополнения и бонусы (6 уровней)
  пополнение_1 INTEGER,
  бонус_1 INTEGER,
  пополнение_2 INTEGER,
  бонус_2 INTEGER,
  пополнение_3 INTEGER,
  бонус_3 INTEGER,
  пополнение_4 INTEGER,
  бонус_4 INTEGER,
  пополнение_5 INTEGER,
  бонус_5 INTEGER,
  пополнение_6 INTEGER,
  бонус_6 INTEGER,
  
  -- Система накопления и привилегий (4 уровня)
  накопление_1 INTEGER,
  привилегия_1 TEXT,
  накопление_2 INTEGER,
  привилегия_2 TEXT,
  накопление_3 INTEGER,
  привилегия_3 TEXT,
  накопление_4 INTEGER,
  привилегия_4 TEXT,
  
  -- Автоматически генерируемое поле (будет создаваться на лету)
  -- js_code TEXT, -- генерируется динамически при запросе
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_locations_user_id ON locations(user_id);
CREATE INDEX idx_locations_название_лк ON locations(название_лк);
```

**Таблица `files` (для загруженных изображений):**
```sql
CREATE TABLE files (
  id SERIAL PRIMARY KEY,
  location_id INTEGER REFERENCES locations(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  original_name VARCHAR(255),
  mime_type VARCHAR(100),
  size INTEGER,
  path VARCHAR(500),
  field_name VARCHAR(100), -- какое поле (приз_1_картинка, картинка и т.д.)
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_files_location_id ON files(location_id);
```

## API Endpoints (Fastify)

### Аутентификация

**POST /api/auth/verify**
- Проверка токена Tilda Members
- Создание/обновление пользователя
- Возврат JWT токена

**GET /api/auth/profile**
- Получение профиля пользователя
- Проверка роли

### Управление локациями (CRUD)

**GET /api/locations**
- Получение списка локаций пользователя
- Для админа: все локации
- Поддержка фильтрации по названию_лк

**GET /api/locations/:id**
- Получение конкретной локации
- Проверка прав доступа
- Возврат с автогенерированным JS-кодом

**POST /api/locations**
- Создание новой локации
- Валидация всех 50+ полей через JSON Schema
- Автоматическая привязка к пользователю

**PUT /api/locations/:id**
- Редактирование локации
- Проверка прав (только владелец или админ)
- Валидация измененных полей

**DELETE /api/locations/:id**
- Удаление локации
- Каскадное удаление связанных файлов
- Проверка прав

### Управление файлами

**POST /api/upload**
- Загрузка изображений (призы, картинка локации)
- Валидация типа (jpg, png, gif, webp)
- Ограничение размера (5MB)
- Сохранение в файловую систему
- Возврат URL для использования

**GET /api/files/:filename**
- Получение файла
- Проверка прав доступа
- Оптимизация раздачи через Nginx

### Специальный endpoint для Tilda

**POST /api/tilda/fetch-content**
- Аналог tools-runner от Collabza
- Принимает профиль из localStorage
- Фильтры по названию_лк
- Возвращает данные в формате, совместимом с текущим скриптом

## Клиентский скрипт для Tilda

### Замена Collabza скрипта

**Файл: `tilda-integration.js`**

```javascript
$(document).ready(function () {
    const block_id = '#rec767556113'.substring(4);
    const block = $('#rec767556113').removeClass('r_hidden').hide();
    
    const api_url = 'https://ваш-домен.ru/api/tilda/fetch-content'; // ВАШ API
    const project_id = $('#allrecords').attr('data-tilda-project-id');
    
    // Получаем профиль пользователя (как в Collabza)
    const profile = JSON.parse(
        localStorage.getItem(`tilda_members_profile${project_id}`) ||
        localStorage.getItem('memberarea_profile') ||
        '{}'
    );
    
    const filters = new URLSearchParams(window.location.search).get('filters' + block_id);
    
    // Запрос к ВАШЕМУ API вместо AWS Lambda
    $.post(api_url, JSON.stringify({
        profile: profile,
        project_id: project_id,
        referer: document.location.origin,
        filters: filters,
    }), function (data) {
        if ('error' in data) {
            block.text('Ошибка загрузки данных: ' + data.error);
            block.css('text-align', 'center').show();
            return;
        }
        
        if (data.records.length > 0) {
            const record = data.records[0];
            
            // Заполнение всех полей (аналогично Collabza)
            if ('название' in record) {
                $('.nazvanie .tn-atom').html(record.название);
            }
            if ('email' in record) {
                $('.email .tn-atom').html(record.email);
            }
            // ... и так далее для всех полей
            
            block.show();
            window.dispatchEvent(new Event('resize'));
        }
    });
});
```

**Ключевые отличия от Collabza:**
- URL запроса на ваш сервер
- Та же логика заполнения форм
- Совместимость с текущей разметкой Tilda

## Миграция данных из Airtable

### Скрипт экспорта/импорта

**Файл: `scripts/migrate-airtable.js`**

```javascript
const Airtable = require('airtable');
const { Pool } = require('pg');

const base = new Airtable({ apiKey: 'ваш_ключ' }).base('appbe0C6aqp5Ulgg6');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrateData() {
  const records = await base('Данные').select().all();
  
  for (const record of records) {
    await pool.query(`
      INSERT INTO locations (
        record_id, название_лк, название, описание, email, 
        номер_телефона, картинка, адрес,
        тайм_карта_1_час, тайм_карта_2_часа, ...
      ) VALUES ($1, $2, $3, ...)
    `, [
      record.id,
      record.fields['Название ЛК'],
      record.fields['Название'],
      // ... все остальные поля
    ]);
  }
}
```

## Технологический стек

### Backend
- **Node.js 18+**
- **Fastify** - веб-фреймворк
- **@fastify/cors** - CORS для Tilda
- **@fastify/multipart** - загрузка файлов
- **@fastify/jwt** - JWT токены
- **PostgreSQL** - база данных
- **pg** - PostgreSQL драйвер
- **dotenv** - конфигурация
- **PM2** - процесс-менеджер

### Frontend (Tilda)
- Vanilla JavaScript
- jQuery (уже в Tilda)
- Axios или Fetch API

### DevOps
- **Nginx** - reverse proxy + статика
- **Let's Encrypt** - SSL сертификаты
- **PM2** - мониторинг и автозапуск
- **Git** - версионирование

## Развертывание на VPS

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

# Установка PM2 глобально
sudo npm install -g pm2
```

### 2. Настройка PostgreSQL

```bash
# Создание базы данных
sudo -u postgres psql
CREATE DATABASE playday_cms;
CREATE USER playday WITH PASSWORD 'безопасный_пароль';
GRANT ALL PRIVILEGES ON DATABASE playday_cms TO playday;
\q
```

### 3. Настройка проекта

```bash
# Клонирование и установка зависимостей
cd /var/www
git clone <репозиторий>
cd playday-cms
npm install

# Настройка .env
cp .env.example .env
nano .env

# Миграция базы данных
npm run migrate

# Миграция данных из Airtable
npm run migrate:airtable
```

### 4. Конфигурация Nginx

**Файл: `/etc/nginx/sites-available/playday-api`**

```nginx
server {
    listen 80;
    server_name api.ваш-домен.ru;

    # Ограничение размера загружаемых файлов
    client_max_body_size 10M;

    # CORS headers
    add_header 'Access-Control-Allow-Origin' 'https://ваш-сайт.tilda.ws' always;
    add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
    add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type' always;

    # Proxy к Fastify
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

    # Раздача статических файлов (изображения)
    location /uploads/ {
        alias /var/www/playday-cms/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

### 5. SSL сертификат

```bash
# Установка Certbot
sudo apt install -y certbot python3-certbot-nginx

# Получение сертификата
sudo certbot --nginx -d api.ваш-домен.ru
```

### 6. Запуск приложения

```bash
# Запуск через PM2
pm2 start npm --name "playday-api" -- start

# Автозапуск при перезагрузке
pm2 startup
pm2 save

# Мониторинг
pm2 monit
```

## Структура проекта

```
playday-cms/
├── src/
│   ├── config/
│   │   └── database.js          # Конфигурация PostgreSQL
│   ├── middleware/
│   │   ├── auth.js               # Аутентификация
│   │   └── roles.js              # Проверка ролей
│   ├── routes/
│   │   ├── auth.js               # Роуты аутентификации
│   │   ├── locations.js          # CRUD локаций
│   │   ├── files.js              # Загрузка файлов
│   │   └── tilda.js              # Интеграция с Tilda
│   ├── schemas/
│   │   └── location.js           # JSON Schema для валидации
│   ├── services/
│   │   ├── location.service.js   # Бизнес-логика
│   │   ├── file.service.js       # Работа с файлами
│   │   └── js-generator.js       # Генератор JS кода для Tilda
│   └── app.js                    # Инициализация Fastify
├── scripts/
│   ├── migrate-airtable.js       # Миграция из Airtable
│   └── seed.js                   # Тестовые данные
├── migrations/
│   └── 001_initial_schema.sql    # SQL миграции
├── public/
│   └── tilda-integration.js      # Скрипт для Tilda
├── uploads/                      # Загруженные файлы
├── .env.example
├── package.json
└── README.md
```

## Безопасность

### Меры защиты

1. **Аутентификация**: JWT токены с истечением
2. **Авторизация**: Проверка прав на уровне БД
3. **Валидация**: JSON Schema для всех входящих данных
4. **Sanitization**: Очистка HTML в описаниях
5. **Rate Limiting**: Ограничение запросов (100 req/min)
6. **File Upload**: 
   - Проверка MIME типов
   - Ограничение размера (5MB)
   - Уникальные имена файлов
7. **SQL Injection**: Использование параметризованных запросов
8. **XSS**: Экранирование выводимых данных
9. **HTTPS**: Обязательный SSL
10. **Environment Variables**: Секреты в .env

### Rate Limiting (Fastify)

```javascript
import rateLimit from '@fastify/rate-limit';

fastify.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute'
});
```

## Мониторинг и логирование

### PM2 Мониторинг

```bash
pm2 monit                    # Интерактивный мониторинг
pm2 logs playday-api         # Просмотр логов
pm2 restart playday-api      # Перезапуск
```

### Логирование (Fastify)

```javascript
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty'
  }
});

fastify.log.info('Server started');
```

## Тестирование

### План тестирования

1. **Unit тесты**: Сервисы и утилиты
2. **Integration тесты**: API endpoints
3. **E2E тесты**: Интеграция с Tilda
4. **Load тесты**: Производительность под нагрузкой

### Тестовые сценарии

- Создание/редактирование/удаление локации
- Загрузка изображений (все поля с картинками)
- Проверка прав доступа (user/admin)
- Получение данных из Tilda скрипта
- Генерация JS кода
- Миграция данных из Airtable

## Этапы реализации

### Этап 1: Подготовка (1-2 дня)
- [ ] Инициализация Node.js проекта
- [ ] Установка Fastify и зависимостей
- [ ] Создание структуры проекта
- [ ] Настройка PostgreSQL локально

### Этап 2: Backend разработка (3-5 дней)
- [ ] Создание схемы БД (50+ полей)
- [ ] SQL миграции
- [ ] Реализация аутентификации через Tilda Members
- [ ] CRUD API для locations
- [ ] JSON Schema валидация всех полей
- [ ] API загрузки файлов (multipart)
- [ ] Генератор JS кода (как в Airtable)
- [ ] Система ролей и прав

### Этап 3: Интеграция с Tilda (1-2 дня)
- [ ] Адаптация скрипта Collabza
- [ ] Endpoint совместимости /api/tilda/fetch-content
- [ ] Тестирование на тестовой странице Tilda
- [ ] Настройка CORS

### Этап 4: Миграция данных (1 день)
- [ ] Скрипт экспорта из Airtable
- [ ] Маппинг полей Airtable → PostgreSQL
- [ ] Импорт всех записей
- [ ] Загрузка изображений из URLs
- [ ] Проверка целостности данных

### Этап 5: Развертывание на VPS (1-2 дня)
- [ ] Настройка VPS (Node.js, PostgreSQL, Nginx)
- [ ] Установка SSL сертификата
- [ ] Деплой приложения через PM2
- [ ] Настройка Nginx reverse proxy
- [ ] Миграция продакшн данных
- [ ] Настройка бэкапов БД

### Этап 6: Тестирование (1-2 дня)
- [ ] Функциональное тестирование всех endpoints
- [ ] Тестирование интеграции с Tilda
- [ ] Проверка загрузки всех типов файлов
- [ ] Тестирование системы ролей
- [ ] Load testing (нагрузочное тестирование)
- [ ] Проверка безопасности

### Этап 7: Переключение (1 день)
- [ ] Замена Collabza скрипта на новый
- [ ] Отключение Make сценариев
- [ ] Перенаправление webhook форм на новый API
- [ ] Мониторинг работы в первые часы
- [ ] Резервный план отката

## Преимущества нового решения

### Технические
- ⚡ **Производительность**: Прямые запросы к БД вместо цепочки Make→Airtable→Collabza
- 🔒 **Безопасность**: Полный контроль над данными и доступом
- 📈 **Масштабируемость**: Легко добавлять новые поля и функции
- 🎯 **Надежность**: Нет зависимости от сторонних сервисов
- 💾 **Бэкапы**: Автоматическое резервное копирование PostgreSQL

### Экономические
- 💰 **Экономия**: ~$50-130/мес на подписках
- 📊 **Прозрачность**: Фиксированные расходы только на VPS
- 🔧 **Гибкость**: Неограниченные пользователи и запросы

### Бизнес
- 🚀 **Скорость разработки**: Быстрое внедрение новых фич
- 👥 **Независимость**: Не зависите от изменений цен и политики сервисов
- 📱 **Возможности**: База для будущего мобильного приложения
- 🎨 **Кастомизация**: Любая логика и интерфейс

## Риски и митигация

### Возможные риски

1. **Потеря данных при миграции**
   - Митигация: Полный бэкап Airtable, тестовая миграция, валидация данных

2. **Простой сервиса**
   - Митигация: Поэтапное переключение, резервный план с Collabza

3. **Проблемы совместимости с Tilda**
   - Митигация: Тестирование на копии страницы, постепенный rollout

4. **Нагрузка на VPS**
   - Митигация: Мониторинг ресурсов, возможность масштабирования

## Поддержка и обслуживание

### Регулярные задачи

- **Ежедневно**: Мониторинг логов PM2
- **Еженедельно**: Проверка бэкапов БД
- **Ежемесячно**: Обновление зависимостей, проверка безопасности

### Документация

- API документация (OpenAPI/Swagger)
- Инструкции по деплою
- Руководство по добавлению новых полей
- Troubleshooting guide

## Контакты и поддержка

После запуска системы вы получите:
- Полный исходный код с комментариями
- README с инструкциями
- API документацию
- Скрипты для бэкапа и восстановления

