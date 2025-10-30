-- Миграция: Копирование email в ma_email для существующих записей
-- Это позволит форме администратора находить локации по email администратора

-- Обновляем ma_email для всех записей, где он пустой
UPDATE locations 
SET ma_email = email
WHERE ma_email IS NULL OR ma_email = '';

-- Проверяем результат
SELECT id, название, email, ma_email 
FROM locations 
ORDER BY id;

