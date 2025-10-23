# 📊 Metabase - GUI для управления базой данных PlayDay CMS

## 🚀 Запуск Metabase

Metabase уже установлен через Docker Compose. Для запуска:

```bash
cd /opt/metabase
docker-compose up -d
```

**Доступ к Metabase:** `http://62.109.26.35:3001`

## 🔧 Первичная настройка

### 1. Создание администратора

При первом открытии Metabase попросит создать учетную запись администратора:

- **Email:** admin@play-day.ru
- **Пароль:** Создайте надежный пароль
- **Имя компании:** PlayDay

### 2. Подключение к базе данных PostgreSQL

На шаге "Add your data":

1. **Database type:** PostgreSQL
2. **Name:** PlayDay CMS
3. **Host:** 
   - Попробуйте: `host.docker.internal`
   - Если не работает: `172.17.0.1` (IP хоста в Docker bridge network)
   - Если не работает: узнайте IP командой `ip addr show docker0`
4. **Port:** `5432`
5. **Database name:** `playday_cms`
6. **Database username:** `playday`
7. **Database password:** Ваш пароль из `.env` файла
8. **Additional JDBC connection string options:** (оставьте пустым)

Нажмите **Save**.

### 3. Если Metabase не может подключиться

**Проблема:** `Connection refused` или `Host unreachable`

**Решение 1 - Разрешите подключения с Docker:**

```bash
# Откройте pg_hba.conf
sudo nano /etc/postgresql/15/main/pg_hba.conf

# Добавьте строку (замените 172.17.0.0/16 на вашу Docker сеть):
host    playday_cms     playday         172.17.0.0/16           md5

# Откройте postgresql.conf
sudo nano /etc/postgresql/15/main/postgresql.conf

# Найдите и измените:
listen_addresses = '*'

# Перезапустите PostgreSQL
sudo systemctl restart postgresql
```

**Решение 2 - Используйте host network mode (уже настроено в docker-compose.yml):**

```yaml
network_mode: host
```

С этой настройкой используйте `localhost` или `127.0.0.1` как хост.

## 📊 Основные возможности Metabase

### 1. Просмотр таблиц

После подключения к БД перейдите в **Browse Data** → **PlayDay CMS** → **locations**

Вы увидите все записи в удобном табличном виде.

### 2. Создание вопросов (Questions)

**Пример: Сколько локаций в базе?**

1. Нажмите **New** → **Question**
2. Выберите **Simple question**
3. Выберите таблицу **locations**
4. В **Summarize** выберите **Count**
5. Нажмите **Visualize**
6. Сохраните вопрос

**Пример: Локации с их email**

1. **New** → **Question** → **Simple question**
2. Таблица **locations**
3. В столбцах выберите: `название`, `email`, `адрес`, `created_at`
4. **Visualize**

### 3. Редактирование данных

Metabase **не предназначен для редактирования данных**. Для этого используйте:

- **Adminer** (уже установлен, если вы следовали предыдущим инструкциям)
- **pgAdmin**
- Или редактируйте через API

### 4. Создание дашбордов

1. **New** → **Dashboard**
2. Дайте название: "Обзор локаций"
3. Добавьте созданные вопросы
4. Настройте фильтры

## 🔐 Безопасность

### Добавление пользователей

1. **Settings** (⚙️) → **Admin** → **People**
2. **Add someone** → введите email
3. Выберите роль:
   - **Admin** - полный доступ
   - **Standard** - просмотр и создание вопросов
   - **View-only** - только просмотр

### Ограничение доступа к таблицам

1. **Settings** → **Admin** → **Permissions**
2. Настройте, какие группы пользователей имеют доступ к каким таблицам

## 📈 Полезные запросы для PlayDay

### Все локации с контактами

```sql
SELECT 
  название, 
  email, 
  номер_телефона, 
  адрес,
  created_at,
  updated_at
FROM locations
ORDER BY created_at DESC;
```

### Локации с заполненными призами

```sql
SELECT 
  название,
  приз_1_текст,
  приз_2_текст,
  приз_3_текст
FROM locations
WHERE приз_1_текст IS NOT NULL;
```

### Цены тайм-карт по локациям

```sql
SELECT 
  название,
  тайм_карта_1_час_цена,
  тайм_карта_2_часа_цена,
  тайм_карта_3_часа_цена,
  тайм_карта_4_часа_цена,
  тайм_карта_5_часов_цена
FROM locations
WHERE тайм_карта_1_час_цена IS NOT NULL;
```

## 🛠️ Управление Metabase

### Проверка статуса

```bash
cd /opt/metabase
docker-compose ps
```

### Остановка

```bash
docker-compose down
```

### Запуск

```bash
docker-compose up -d
```

### Просмотр логов

```bash
docker-compose logs -f metabase
```

### Обновление Metabase

```bash
docker-compose pull
docker-compose up -d
```

## 🔄 Альтернатива: Adminer

Если Metabase кажется сложным, используйте Adminer для прямого редактирования данных:

**Установка Adminer:**

```bash
cd /opt
sudo mkdir adminer
cd adminer

# Скачайте Adminer
sudo wget https://github.com/vrana/adminer/releases/download/v4.8.1/adminer-4.8.1.php -O index.php

# Настройте Nginx
sudo nano /etc/nginx/sites-available/adminer

# Добавьте:
server {
    listen 3002;
    server_name _;
    root /opt/adminer;
    index index.php;
    
    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/var/run/php/php8.1-fpm.sock;
    }
}

# Активируйте
sudo ln -s /etc/nginx/sites-available/adminer /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Установите PHP-FPM
sudo apt install php-fpm php-pgsql -y
```

**Доступ к Adminer:** `http://62.109.26.35:3002`

**Вход:**
- System: PostgreSQL
- Server: localhost
- Username: playday
- Password: ваш пароль
- Database: playday_cms

## 📞 Поддержка

Если возникли проблемы:

1. Проверьте логи: `docker-compose logs -f metabase`
2. Проверьте подключение к PostgreSQL: `psql -h localhost -U playday -d playday_cms`
3. Проверьте Docker сеть: `docker network ls` и `docker network inspect bridge`
