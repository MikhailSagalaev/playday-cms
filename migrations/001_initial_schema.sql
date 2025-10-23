-- Миграция: Создание схемы базы данных для системы управления контентом развлекательных центров
-- Версия: 1.0
-- Дата: 2024-12-10

-- Создание расширений
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Таблица пользователей (аутентификация через Tilda Members)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    tilda_user_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('user', 'editor', 'admin')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Создание индекса для быстрого поиска по tilda_user_id
CREATE INDEX idx_users_tilda_user_id ON users(tilda_user_id);

-- Основная таблица локаций (заменяет Airtable "Данные")
CREATE TABLE locations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    record_id VARCHAR(50) UNIQUE, -- для совместимости с Airtable ID
    
    -- Базовая информация о локации
    название_лк VARCHAR(255),
    название VARCHAR(500),
    описание TEXT,
    email VARCHAR(255),
    номер_телефона VARCHAR(50),
    картинка VARCHAR(500),
    адрес TEXT,
    
    -- Тайм-карты (цены на игровое время) - оригинальные цены из Airtable
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
    
    -- Тайм-карты (реальные цены для отображения)
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
    
    -- Дополнительные поля из Tilda
    ma_name VARCHAR(255),
    ma_email VARCHAR(255),
    tranid VARCHAR(255),
    formid VARCHAR(255),
    
    -- Метаданные
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Индексы для оптимизации запросов
CREATE INDEX idx_locations_user_id ON locations(user_id);
CREATE INDEX idx_locations_название_лк ON locations(название_лк);
CREATE INDEX idx_locations_record_id ON locations(record_id);

-- Таблица файлов (для загруженных изображений)
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

-- Индексы для файлов
CREATE INDEX idx_files_location_id ON files(location_id);
CREATE INDEX idx_files_filename ON files(filename);

-- Таблица для логирования действий пользователей
CREATE TABLE activity_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(100) NOT NULL, -- create, update, delete, view
    table_name VARCHAR(50) NOT NULL, -- locations, files
    record_id INTEGER,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Индекс для логов
CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at);

-- Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Триггеры для автоматического обновления updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_locations_updated_at BEFORE UPDATE ON locations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Создание пользователя базы данных для приложения
-- (выполняется отдельно на сервере)
-- CREATE USER playday WITH PASSWORD 'secure_password_here';
-- GRANT ALL PRIVILEGES ON DATABASE playday_cms TO playday;
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO playday;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO playday;

-- Комментарии к таблицам
COMMENT ON TABLE users IS 'Пользователи системы (аутентификация через Tilda Members)';
COMMENT ON TABLE locations IS 'Основная таблица контента для развлекательных центров (50+ полей)';
COMMENT ON TABLE files IS 'Загруженные файлы (изображения призов, картинки локаций)';
COMMENT ON TABLE activity_logs IS 'Логирование действий пользователей для аудита';

-- Комментарии к ключевым полям
COMMENT ON COLUMN locations.название_лк IS 'Название личного кабинета (идентификатор филиала)';
COMMENT ON COLUMN locations.тайм_карта_1_час IS 'Цена тайм-карты на 1 час (оригинальная из Airtable)';
COMMENT ON COLUMN locations.тайм_карта_1_час_цена IS 'Цена тайм-карты на 1 час (для отображения на сайте)';
COMMENT ON COLUMN files.field_name IS 'Название поля в таблице locations (приз_1_картинка, картинка и т.д.)';
