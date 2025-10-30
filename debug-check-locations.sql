-- Проверка всех локаций и их email адресов
SELECT 
  id,
  название,
  email,
  ma_email,
  ma_name,
  record_id,
  created_at,
  updated_at
FROM locations
ORDER BY updated_at DESC;

-- Поиск конкретной локации
SELECT * FROM locations 
WHERE ma_email = 'n-chelni@play-day.ru' 
   OR email = 'n-chelni@play-day.ru';

