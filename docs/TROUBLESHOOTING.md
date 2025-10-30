# Решение проблем PlayDay CMS

## Проблема: Форма администратора не заполняется данными

### Симптомы
```javascript
🚀 PlayDay Admin Form: Загрузка данных для n-chelni@play-day.ru
✅ PlayDay Admin Form: Данные получены Object (Email: "gcity@play-day.ru" ...)
✅ PlayDay Admin Form: Форма заполнена успешно
```

Но в консоли видно, что **данные получены для другого email** (`gcity@play-day.ru`), не для запрошенного (`n-chelni@play-day.ru`).

### Причина
В базе данных **нет записи с полем `ma_email = 'n-chelni@play-day.ru'`**.

API ищет локацию по условию:
```sql
WHERE email = $1 OR record_id = $1 OR ma_email = $1
```

Если запись не найдена, API возвращает **404 Not Found**. Но если в логах видно, что данные пришли для другого email, значит:
- В базе есть запись с `email = 'n-chelni@play-day.ru'` (но не с `ma_email`)
- Или API находит другую запись по `record_id`

### Решение

#### Шаг 1: Проверьте данные в базе

Подключитесь к серверу и выполните SQL запрос:

```bash
# На сервере
ssh root@62.109.26.35

# Подключитесь к PostgreSQL
sudo -u postgres psql playday

# Выполните запрос
SELECT id, название, email, ma_email, ma_name, record_id 
FROM locations 
ORDER BY updated_at DESC;
```

Или используйте Metabase: `http://62.109.26.35:3001`

#### Шаг 2: Найдите нужную запись

Найдите запись для локации Набережные Челны. Проверьте:
- Есть ли у неё поле `ma_email`?
- Совпадает ли оно с email администратора в Tilda Members?

#### Шаг 3: Обновите данные

Если запись есть, но `ma_email` не заполнен:

```sql
-- Обновите ma_email для нужной локации
UPDATE locations 
SET ma_email = 'n-chelni@play-day.ru',
    ma_name = 'Имя Администратора'
WHERE email = 'chelny@play-day.ru'; -- Укажите правильный email локации
```

#### Шаг 4: Или создайте новую запись через Tilda

Самый простой способ — **отправить форму на Tilda**, которая отправляет данные через вебхук.

В форме должны быть скрытые поля:
```html
<input type="hidden" name="ma_name" value="Имя Администратора">
<input type="hidden" name="ma_email" value="n-chelni@play-day.ru">
```

Вебхук автоматически создаст/обновит запись с этими данными.

#### Шаг 5: Проверьте работу

1. Откройте страницу с формой администратора
2. Откройте консоль браузера (F12)
3. Обновите страницу
4. Проверьте логи:
   - `🚀 PlayDay Admin Form: Загрузка данных для n-chelni@play-day.ru`
   - `✅ PlayDay Admin Form: Данные получены Object (Email: "n-chelni@play-day.ru" ...)` ← должен совпадать!

---

## Проблема: API возвращает 404 Not Found

### Причина
В базе данных нет записи с указанным `email`, `ma_email` или `record_id`.

### Решение

1. **Проверьте email в Tilda Members**:
   - Откройте консоль браузера
   - Выполните:
   ```javascript
   const project_id = $('#allrecords').attr('data-tilda-project-id');
   const profile = JSON.parse(localStorage.getItem(`tilda_members_profile${project_id}`));
   console.log(profile);
   ```
   - Проверьте, какой `email`, `ma_email` или `login` указан

2. **Проверьте базу данных**:
   ```sql
   SELECT * FROM locations WHERE ma_email = 'email-из-консоли';
   ```

3. **Создайте запись** (если её нет):
   - Отправьте форму через Tilda с вебхуком
   - Или вручную через SQL:
   ```sql
   INSERT INTO locations (название, email, ma_email, ma_name, record_id)
   VALUES ('Название локации', 'location@play-day.ru', 'admin@play-day.ru', 'Администратор', 'recXXXXXXXXXX');
   ```

---

## Проблема: Форма заполняется, но некоторые поля пустые

### Причина
В базе данных для этих полей записано `NULL` или пустая строка.

### Решение

1. **Проверьте данные в Metabase** или через SQL:
   ```sql
   SELECT * FROM locations WHERE ma_email = 'ваш-email@play-day.ru';
   ```

2. **Обновите поля**:
   ```sql
   UPDATE locations 
   SET 
     тайм_карта_2_часа = 2000,
     тайм_карта_3_часа = 3000,
     приз_1_текст = 'Текст приза 1'
   WHERE ma_email = 'ваш-email@play-day.ru';
   ```

3. **Или отправьте форму через Tilda** с заполненными полями — вебхук автоматически обновит данные.

---

## Проблема: Скрипт не загружается (404)

### Симптомы
```
GET https://api.play-day.ru/playday-admin-form.js 404 (Not Found)
```

### Решение

1. **Проверьте Nginx конфигурацию**:
   ```bash
   sudo nano /etc/nginx/sites-available/playday-api-fixed.conf
   ```

2. **Убедитесь, что есть блок**:
   ```nginx
   location = /playday-admin-form.js {
       alias /opt/playday-cms/public/playday-admin-form.js;
       add_header Content-Type application/javascript;
       add_header Cache-Control "no-cache, no-store, must-revalidate";
       add_header 'Access-Control-Allow-Origin' '*' always;
   }
   ```

3. **Перезагрузите Nginx**:
   ```bash
   sudo nginx -t
   sudo systemctl reload nginx
   ```

4. **Проверьте файл**:
   ```bash
   ls -la /opt/playday-cms/public/playday-admin-form.js
   ```

---

## Проблема: CORS ошибки

### Симптомы
```
Access to XMLHttpRequest at 'https://api.play-day.ru/api/public/location/...' 
from origin 'https://play-day.ru' has been blocked by CORS policy
```

### Решение

1. **Проверьте Nginx конфигурацию** — CORS должен быть настроен **только в Nginx**, не в Fastify:

   ```nginx
   add_header 'Access-Control-Allow-Origin' '*' always;
   add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS' always;
   add_header 'Access-Control-Allow-Headers' 'Content-Type, Authorization' always;
   ```

2. **В `src/app.js` CORS должен быть ОТКЛЮЧЕН**:
   ```javascript
   // CORS отключен - обрабатывается на уровне Nginx
   // await fastify.register(require('@fastify/cors'), { ... });
   ```

3. **Перезагрузите сервисы**:
   ```bash
   sudo systemctl reload nginx
   pm2 restart playday-cms
   ```

---

## Полезные команды для отладки

### Просмотр логов API
```bash
# Логи Fastify приложения
pm2 logs playday-cms

# Последние 50 строк
pm2 logs playday-cms --lines 50

# Только ошибки
pm2 logs playday-cms --err
```

### Просмотр логов Nginx
```bash
# Access log
sudo tail -f /var/log/nginx/playday-api-access.log

# Error log
sudo tail -f /var/log/nginx/playday-api-error.log
```

### Проверка статуса сервисов
```bash
# PM2
pm2 status

# Nginx
sudo systemctl status nginx

# PostgreSQL
sudo systemctl status postgresql

# Metabase
sudo systemctl status metabase
```

### Проверка базы данных
```bash
# Подключение к PostgreSQL
sudo -u postgres psql playday

# Список таблиц
\dt

# Описание таблицы
\d locations

# Выход
\q
```

### Тест API вручную
```bash
# Проверка публичного API
curl https://api.play-day.ru/api/public/location/gcity@play-day.ru

# Проверка вебхука
curl -X POST https://api.play-day.ru/api/webhook/tilda \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "test=test"
```

---

## Контакты для поддержки

- **Документация**: `/docs` в репозитории
- **API Docs**: http://62.109.26.35:3000/docs
- **Metabase**: http://62.109.26.35:3001
- **GitHub**: (ссылка на репозиторий)

