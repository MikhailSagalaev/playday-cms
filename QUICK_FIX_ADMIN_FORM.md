# 🚀 Быстрое решение проблемы с формой администратора

## Проблема
Форма администратора на странице Набережных Челнов не заполняется данными из базы.

## Решение (5 минут)

### На сервере выполни:

```bash
# 1. Подключись к серверу
ssh root@62.109.26.35

# 2. Обнови код
cd /opt/playday-cms
git pull origin main

# 3. Подключись к PostgreSQL
sudo -u postgres psql playday

# 4. Выполни миграцию (скопирует email в ma_email)
\i /opt/playday-cms/migrations/003_copy_email_to_ma_email.sql

# Вывод:
# UPDATE 4  (или сколько у тебя записей)
# 
# id | название           | email                   | ma_email
# ----+--------------------+-------------------------+-------------------------
#  1 | ...                | gcity@play-day.ru       | gcity@play-day.ru
#  4 | Набережные Челны   | n-chelni@play-day.ru    | n-chelni@play-day.ru
# ...

# 5. Выйди из PostgreSQL
\q

# 6. Обнови статические файлы на сервере
cd /opt/playday-cms
cp public/playday-admin-form.js /opt/playday-cms/public/

# Готово! ✅
```

### Проверь работу

1. Открой страницу формы администратора для Набережных Челнов
2. Открой консоль браузера (F12)
3. Обновись страницу (Ctrl+R)
4. В консоли должно быть:

```javascript
🔍 PlayDay Admin Form: Профиль пользователя: {email: "n-chelni@play-day.ru", ...}
🚀 PlayDay Admin Form: Загрузка данных для n-chelni@play-day.ru
✅ PlayDay Admin Form: Данные получены {Email: "n-chelni@play-day.ru", ...}  ← Теперь совпадает!
✅ PlayDay Admin Form: Форма заполнена успешно
```

**Форма должна заполниться данными!** 🎉

---

## Что было сделано

1. **Создана миграция** `003_copy_email_to_ma_email.sql` — копирует `email` в `ma_email`
2. **Добавлено детальное логирование** в скрипт — показывает профиль и предупреждает о несовпадении
3. **Обновлена документация** — добавлен раздел "Решение проблем"

---

## Если всё равно не работает

Проверь в консоли браузера, какой email администратора:

```javascript
const project_id = $('#allrecords').attr('data-tilda-project-id');
const profile = JSON.parse(localStorage.getItem(`tilda_members_profile${project_id}`));
console.log('Email администратора:', profile.email, profile.ma_email, profile.login);
```

Затем проверь в базе:

```sql
SELECT * FROM locations WHERE email = 'email-из-консоли' OR ma_email = 'email-из-консоли';
```

Если запись не найдена — создай её вручную или отправь форму через Tilda с вебхуком.

---

## Полная документация

- **Акт выполненных работ:** `docs/ACT_WORK_COMPLETED.md`
- **Решение проблем:** `docs/TROUBLESHOOTING.md`
- **Интеграция Tilda:** `TILDA_INTEGRATION.md`
- **Форма администратора:** `ADMIN_FORM_INTEGRATION.md`

