-- Миграция для добавления недостающих полей из Tilda
-- Выполняется: 2025-10-23

-- Добавляем недостающие колонки в таблицу locations
ALTER TABLE locations 
ADD COLUMN IF NOT EXISTS ma_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS ma_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS tranid VARCHAR(255),
ADD COLUMN IF NOT EXISTS formid VARCHAR(255);

-- Добавляем комментарии к новым колонкам
COMMENT ON COLUMN locations.ma_name IS 'Имя менеджера из Tilda';
COMMENT ON COLUMN locations.ma_email IS 'Email менеджера из Tilda';
COMMENT ON COLUMN locations.tranid IS 'ID транзакции из Tilda';
COMMENT ON COLUMN locations.formid IS 'ID формы из Tilda';
