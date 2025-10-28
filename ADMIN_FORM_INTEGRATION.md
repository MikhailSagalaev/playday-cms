# 🔐 Интеграция формы администратора PlayDay CMS с Tilda

## 📋 Описание

Этот документ описывает, как настроить форму редактирования данных локации в личном кабинете администратора на Tilda Members.

## 🎯 Что делает скрипт

Скрипт автоматически:
1. Определяет email администратора из профиля Tilda Members
2. Загружает данные локации из PlayDay CMS API
3. Заполняет все поля формы соответствующими значениями
4. Позволяет редактировать и отправлять обновленные данные через вебхук

## 🚀 Быстрый старт

### 1. Создайте форму в Tilda Members

1. Создайте страницу в разделе **Tilda Members** (личный кабинет)
2. Добавьте блок формы (например, **T123**)
3. Настройте поля формы, соответствующие структуре базы данных

### 2. Вставьте скрипт на страницу

Добавьте блок **T123 (HTML-код)** ПОСЛЕ формы:

#### Вариант A: Внешний скрипт (рекомендуется)

```html
<script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
<script>
  // Укажите ID блока формы (найдите в инспекторе элементов)
  window.PLAYDAY_FORM_BLOCK_ID = 'rec759480568'; // Замените на ваш ID
</script>
<script src="https://api.play-day.ru/playday-admin-form.js"></script>
```

#### Вариант B: Встроенный скрипт

<details>
<summary>Нажмите, чтобы развернуть встроенный скрипт</summary>

```html
<script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
<script>
(function() {
  'use strict';
  
  const PLAYDAY_API_URL = 'https://api.play-day.ru/api/public/location';
  const FORM_BLOCK_ID = 'rec759480568'; // Замените на ID вашего блока
  
  $(document).ready(function() {
    const block = $('#' + FORM_BLOCK_ID).removeClass('r_hidden').hide();
    
    const project_id = $('#allrecords').attr('data-tilda-project-id');
    const profile = JSON.parse(
      localStorage.getItem(`tilda_members_profile${project_id}`) ||
      localStorage.getItem('memberarea_profile') || '{}'
    );
    
    if (!profile.email) {
      block.text('Ошибка: необходимо войти в систему').css('text-align', 'center').show();
      return;
    }
    
    $.ajax({
      url: `${PLAYDAY_API_URL}/${encodeURIComponent(profile.email)}`,
      method: 'GET',
      dataType: 'json',
      success: function(data) {
        if (!data || !data.records || data.records.length === 0) {
          block.show();
          return;
        }
        
        const record = data.records[0];
        
        // Заполняем текстовые поля
        block.find('.t-input-group input, .t-input-group textarea, .t-input-group select').each(function() {
          const input = $(this);
          const field = input.attr('name');
          
          if (field && field in record && record[field] !== null) {
            input.val(record[field]);
            input.trigger('change');
          }
        });
        
        // Заполняем скрытые поля
        block.find('input[type="hidden"]').each(function() {
          const input = $(this);
          const field = input.attr('name');
          
          if (field && field in record && record[field] !== null) {
            input.val(record[field]);
          }
        });
        
        block.show();
        window.dispatchEvent(new Event('resize'));
      },
      error: function(xhr, status, error) {
        block.text('Ошибка загрузки данных').css('text-align', 'center').show();
      }
    });
  });
})();
</script>
```

</details>

### 3. Настройте поля формы

Убедитесь, что имена полей формы (`name` атрибут) соответствуют полям в базе данных:

#### Основные поля:
- `название` - Название локации
- `email` - Email (автоматически берется из профиля)
- `адрес` - Адрес локации
- `описание` - Описание (может содержать HTML)
- `номер_телефона` - Телефон
- `картинка` - URL картинки обложки

#### Тайм-карты:
- `тайм_карта_1_час`
- `тайм_карта_2_часа`
- `тайм_карта_3_часа`
- `тайм_карта_4_часа`
- `тайм_карта_5_часов`

#### Призы:
- `приз_1_текст`, `приз_1_картинка`
- `приз_2_текст`, `приз_2_картинка`
- `приз_3_текст`, `приз_3_картинка`
- `призы_текст`

#### Акции:
- `пополнить_карту_сумма`
- `дата_следующего_розыгрыша`
- `заголовок_четверг_по_30`
- `каждый_четверг_текст`

#### Цены:
- `тайм_карта_1_час_цена`
- `тайм_карта_2_часа_цена`
- `тайм_карта_3_часа_цена`
- `тайм_карта_4_часа_цена`
- `тайм_карта_5_часов_цена`

#### Пополнения и бонусы:
- `пополнение_1`, `бонус_1`
- `пополнение_2`, `бонус_2`
- `пополнение_3`, `бонус_3`
- `пополнение_4`, `бонус_4`
- `пополнение_5`, `бонус_5`
- `пополнение_6`, `бонус_6`

#### Накопления и привилегии:
- `накопление_1`, `привилегия_1`
- `накопление_2`, `привилегия_2`
- `накопление_3`, `привилегия_3`
- `накопление_4`, `привилегия_4`

#### Служебные поля:
- `record_id` - ID записи (скрытое поле)

### 4. Настройте вебхук для сохранения

После заполнения формы данные должны отправляться обратно в CMS:

1. Откройте **Настройки формы** в редакторе Tilda
2. Перейдите в **После отправки** → **Webhook**
3. Укажите URL: `https://api.play-day.ru/api/webhook/tilda`
4. При отправке формы данные автоматически обновятся в базе данных

## 🔍 Как найти ID блока формы

1. Откройте страницу с формой в редакторе Tilda
2. Нажмите **F12** (открыть инспектор)
3. Найдите элемент формы в HTML (обычно `<div id="rec759480568">`)
4. Скопируйте ID (например, `rec759480568`)
5. Вставьте в переменную `FORM_BLOCK_ID` в скрипте

## 📝 Поддерживаемые типы полей

Скрипт автоматически заполняет следующие типы полей Tilda:

| Тип поля | Класс Tilda | Описание |
|----------|-------------|----------|
| Email | `t-input-group_em` | Email адрес |
| Name | `t-input-group_nm` | Имя |
| Input | `t-input-group_in` | Текстовое поле |
| URL | `t-input-group_ur` | URL адрес |
| Date | `t-input-group_da` | Дата |
| Time | `t-input-group_tm` | Время |
| Range | `t-input-group_rg` | Диапазон |
| Quantity | `t-input-group_qn` | Количество |
| Phone | `t-input-group_ph` | Телефон (с маской) |
| Textarea | `t-input-group_ta` | Многострочное поле |
| Select | `t-input-group_sb` | Выпадающий список |
| Checkbox | `t-input-group_cb` | Чекбокс |
| Radio | `t-input-group_rd`, `t-input-group_ri` | Радио-кнопки |
| Uploadcare | `t-input-group_uc` | Загрузка файлов |

## 🔄 Процесс работы

```
┌─────────────────────────────────────────────────────────────┐
│  1. Администратор заходит в личный кабинет Tilda Members    │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  2. Скрипт получает email из профиля Tilda Members          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  3. Загружает данные из PlayDay CMS API по email            │
│     GET /api/public/location/:email                         │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  4. Заполняет все поля формы соответствующими значениями    │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  5. Администратор редактирует данные и отправляет форму     │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  6. Вебхук отправляет данные обратно в PlayDay CMS          │
│     POST /api/webhook/tilda                                 │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  7. Данные обновляются в PostgreSQL                         │
│     (по record_id или email)                                │
└─────────────────────────────────────────────────────────────┘
```

## 🛠️ Отладка

### Проверка в консоли браузера

Откройте консоль разработчика (F12) и найдите сообщения:

- `🚀 PlayDay Admin Form: Загрузка данных для email@example.com` - скрипт запущен
- `✅ PlayDay Admin Form: Данные получены` - данные успешно загружены
- `✅ PlayDay Admin Form: Форма заполнена успешно` - форма заполнена
- `❌ PlayDay Admin Form: Ошибка загрузки данных` - ошибка загрузки

### Проверка API

Вручную проверьте доступность данных:

```bash
curl https://api.play-day.ru/api/public/location/gcity@play-day.ru
```

### Проверка вебхука

Проверьте логи на сервере после отправки формы:

```bash
pm2 logs playday-cms
```

## 💡 Примеры использования

### Пример 1: Простая форма редактирования

```html
<!-- Tilda Form Block -->
<form id="form759480568">
  <input type="text" name="название" placeholder="Название локации">
  <input type="email" name="email" placeholder="Email" readonly>
  <input type="text" name="адрес" placeholder="Адрес">
  <input type="hidden" name="record_id">
  <button type="submit">Сохранить</button>
</form>

<!-- Скрипт заполнения -->
<script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
<script src="https://api.play-day.ru/playday-admin-form.js"></script>
<script>
  window.PLAYDAY_FORM_BLOCK_ID = 'rec759480568';
</script>
```

### Пример 2: Форма с картинками (Uploadcare)

```html
<input type="text" name="приз_1_картинка" 
       data-uploadcare-public-key="YOUR_KEY"
       role="uploadcare-uploader">
```

Скрипт автоматически подставит URL картинки из базы данных.

## ⚠️ Важные замечания

1. **Email в профиле обязателен**: Скрипт использует email из профиля Tilda Members для загрузки данных
2. **Названия полей должны совпадать**: Атрибут `name` в форме должен точно соответствовать полю в БД
3. **record_id для обновления**: Добавьте скрытое поле `record_id`, чтобы вебхук мог обновлять существующую запись
4. **Вебхук настроен на форму**: Убедитесь, что вебхук указывает на `https://api.play-day.ru/api/webhook/tilda`

## 🔗 Связанные документы

- [Интеграция с Tilda (публичные страницы)](TILDA_INTEGRATION.md)
- [API документация](http://62.109.26.35:3000/docs)
- [Структура базы данных](migrations/001_initial_schema.sql)

## 📞 Поддержка

При возникновении проблем проверьте:
1. Консоль браузера на наличие ошибок
2. Логи сервера: `pm2 logs playday-cms`
3. Доступность API: `curl https://api.play-day.ru/api/public/location/ваш-email`

