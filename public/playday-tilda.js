/**
 * PlayDay CMS - Скрипт интеграции с Tilda
 * Замена Collabza для динамического заполнения контента на страницах Tilda
 * 
 * Использование:
 * 1. Вставьте этот скрипт в HTML-блок на странице Tilda
 * 2. Укажите email локации в переменной PLAYDAY_LOCATION_EMAIL
 * 3. Скрипт автоматически заполнит все поля с классами из списка ниже
 */

(function() {
  'use strict';
  
  // ===========================================
  // НАСТРОЙКИ - ИЗМЕНИТЕ ПОД ВАШИ НУЖДЫ
  // ===========================================
  
  // URL вашего PlayDay CMS API
  const PLAYDAY_API_URL = 'https://62.109.26.35/api/public/location';
  
  // Email локации для получения данных (можно также использовать record_id)
  // Получаем из профиля Tilda Members или из параметра URL
  const project_id = $('#allrecords').attr('data-tilda-project-id');
  const profile = JSON.parse(
    localStorage.getItem(`tilda_members_profile${project_id}`) ||
    localStorage.getItem('memberarea_profile') ||                
    '{}'
  );
  
  const PLAYDAY_LOCATION_EMAIL = profile.email || window.PLAYDAY_LOCATION_EMAIL || 'gcity@play-day.ru';
  
  // ===========================================
  // ОСНОВНОЙ КОД
  // ===========================================
  
  $(document).ready(function() {
    console.log('🚀 PlayDay CMS: Загрузка данных для', PLAYDAY_LOCATION_EMAIL);
    
    // Получаем данные с API
    $.ajax({
      url: `${PLAYDAY_API_URL}/${encodeURIComponent(PLAYDAY_LOCATION_EMAIL)}`,
      method: 'GET',
      dataType: 'json',
      success: function(data) {
        if (!data || !data.records || data.records.length === 0) {
          console.error('❌ PlayDay CMS: Данные не найдены');
          return;
        }
        
        const record = data.records[0];
        console.log('✅ PlayDay CMS: Данные получены', record);
        
        // Заполняем контент на странице
        fillPageContent(record);
      },
      error: function(xhr, status, error) {
        console.error('❌ PlayDay CMS: Ошибка загрузки данных', error);
        console.error('Статус:', status);
        console.error('Ответ:', xhr.responseText);
      }
    });
  });
  
  /**
   * Заполняет контент на странице данными из API
   */
  function fillPageContent(record) {
    // Базовая информация
    setContent('.nazvanie .tn-atom', record.название);
    setContent('.email .tn-atom', record.email);
    setContent('.phone .tn-atom', record.номер_телефона);
    setContent('.address .tn-atom', record.адрес);
    
    // Описание (может содержать HTML)
    if (record.описание) {
      $('.description .tn-atom').html(record.описание);
    }
    
    // Картинка обложки
    if (record.картинка) {
      $('.coverimg .tn-atom__img').attr('src', record.картинка);
      $('.coverimg .tn-atom').css('background-image', `url(${record.картинка})`);
    }
    
    // Тайм-карты (стоимость)
    setContent('.1h-card .tn-atom', record.тайм_карта_1_час);
    setContent('.2h-card .tn-atom', record.тайм_карта_2_часа);
    setContent('.3h-card .tn-atom', record.тайм_карта_3_часа);
    setContent('.4h-card .tn-atom', record.тайм_карта_4_часа);
    setContent('.5h-card .tn-atom', record.тайм_карта_5_часов);
    
    // Призы
    setContent('.prizetxt1 .tn-atom', record.приз_1_текст);
    setContent('.prizetxt2 .tn-atom', record.приз_2_текст);
    setContent('.prizetxt3 .tn-atom', record.приз_3_текст);
    
    // Картинки призов
    if (record.приз_1_картинка) {
      $('.prizeimg1 .tn-atom').css('background-image', `url(${record.приз_1_картинка})`);
      $('.prizeimg1 .tn-atom__img').attr('src', record.приз_1_картинка);
    }
    if (record.приз_2_картинка) {
      $('.prizeimg2 .tn-atom').css('background-image', `url(${record.приз_2_картинка})`);
      $('.prizeimg2 .tn-atom__img').attr('src', record.приз_2_картинка);
    }
    if (record.приз_3_картинка) {
      $('.prizeimg3 .tn-atom').css('background-image', `url(${record.приз_3_картинка})`);
      $('.prizeimg3 .tn-atom__img').attr('src', record.приз_3_картинка);
    }
    
    setContent('.prizealltxt .tn-atom', record.призы_текст);
    setContent('.rozegrishtxt .tn-atom', record.розыгрыш_тайм_карт_текст);
    setContent('.600 .tn-atom', record.пополнить_карту_сумма);
    setContent('.nextdate .tn-atom', record.дата_следующего_розыгрыша);
    
    // Акции
    setContent('.akciatxt .tn-atom', record.каждый_четверг_текст);
    setContent('.every30 .tn-atom', record.заголовок_четверг_по_30);
    setContent('.skidka1 .tn-atom', record.скидка_1);
    setContent('.skidka2 .tn-atom', record.скидка_2);
    
    // Тайм-карты (цены для отображения)
    if (record.тайм_карта_1_час_цена) {
      setContent('.time-card1 .tn-atom', record.тайм_карта_1_час_цена + ' руб.');
    }
    if (record.тайм_карта_2_часа_цена) {
      setContent('.time-card2 .tn-atom', record.тайм_карта_2_часа_цена + ' руб.');
    }
    if (record.тайм_карта_3_часа_цена) {
      setContent('.time-card3 .tn-atom', record.тайм_карта_3_часа_цена + ' руб.');
    }
    if (record.тайм_карта_4_часа_цена) {
      setContent('.time-card4 .tn-atom', record.тайм_карта_4_часа_цена + ' руб.');
    }
    if (record.тайм_карта_5_часов_цена) {
      setContent('.time-card5 .tn-atom', record.тайм_карта_5_часов_цена + ' руб.');
    }
    
    // Пополнения и бонусы
    if (record.пополнение_1) setContent('.vznos1 .tn-atom', record.пополнение_1 + ' руб.');
    if (record.пополнение_2) setContent('.vznos2 .tn-atom', record.пополнение_2 + ' руб.');
    if (record.пополнение_3) setContent('.vznos3 .tn-atom', record.пополнение_3 + ' руб.');
    if (record.пополнение_4) setContent('.vznos4 .tn-atom', record.пополнение_4 + ' руб.');
    if (record.пополнение_5) setContent('.vznos5 .tn-atom', record.пополнение_5 + ' руб.');
    if (record.пополнение_6) setContent('.vznos6 .tn-atom', record.пополнение_6 + ' руб.');
    
    setContent('.bonus1 .tn-atom', record.бонус_1 ? '+' + record.бонус_1 : '');
    setContent('.bonus2 .tn-atom', record.бонус_2 ? '+' + record.бонус_2 : '');
    setContent('.bonus3 .tn-atom', record.бонус_3 ? '+' + record.бонус_3 : '');
    setContent('.bonus4 .tn-atom', record.бонус_4 ? '+' + record.бонус_4 : '');
    setContent('.bonus5 .tn-atom', record.бонус_5 ? '+' + record.бонус_5 : '');
    setContent('.bonus6 .tn-atom', record.бонус_6 ? '+' + record.бонус_6 : '');
    
    // Накопления и привилегии
    setContent('.nakoplenie1 .tn-atom', record.накопление_1);
    setContent('.privilegia1 .tn-atom', record.привилегия_1);
    setContent('.nakoplenie2 .tn-atom', record.накопление_2);
    setContent('.privilegia2 .tn-atom', record.привилегия_2);
    setContent('.nakoplenie3 .tn-atom', record.накопление_3);
    setContent('.privilegia3 .tn-atom', record.привилегия_3);
    setContent('.nakoplenie4 .tn-atom', record.накопление_4);
    setContent('.privilegia4 .tn-atom', record.привилегия_4);
    
    console.log('✅ PlayDay CMS: Контент заполнен успешно');
    
    // Обновляем макет страницы
    window.dispatchEvent(new Event('resize'));
  }
  
  /**
   * Устанавливает контент в элемент, если он существует
   */
  function setContent(selector, content) {
    if (content !== null && content !== undefined && content !== '') {
      const $element = $(selector);
      if ($element.length > 0) {
        $element.html(content);
      }
    }
  }
  
})();
