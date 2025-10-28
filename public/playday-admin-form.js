/**
 * PlayDay CMS - Скрипт заполнения формы администратора
 * Загружает данные из PlayDay CMS и заполняет форму для редактирования
 * 
 * Использование:
 * 1. Вставьте этот скрипт в HTML-блок формы на странице Tilda Members
 * 2. Укажите ID блока формы в переменной FORM_BLOCK_ID
 * 3. Скрипт автоматически загрузит данные локации из API
 */

(function() {
  'use strict';
  
  // ===========================================
  // НАСТРОЙКИ
  // ===========================================
  
  // URL вашего PlayDay CMS API
  const PLAYDAY_API_URL = 'https://api.play-day.ru/api/public/location';
  
  // ID блока формы (например: 'rec759480568')
  const FORM_BLOCK_ID = 'rec759480568'; // Замените на ID вашего блока
  
  // ===========================================
  // ОСНОВНОЙ КОД
  // ===========================================
  
  $(document).ready(function() {
    const block_id = FORM_BLOCK_ID.replace('rec', '');
    const block = $('#' + FORM_BLOCK_ID).removeClass('r_hidden').hide();
    
    // Получаем профиль пользователя из Tilda Members
    const project_id = $('#allrecords').attr('data-tilda-project-id');
    const profile = JSON.parse(
      localStorage.getItem(`tilda_members_profile${project_id}`) ||
      localStorage.getItem('memberarea_profile') ||                
      '{}'
    );
    
    if (!profile.email) {
      console.error('❌ PlayDay Admin Form: Email пользователя не найден');
      block.text('Ошибка: необходимо войти в систему');
      block.css('text-align', 'center').show();
      return;
    }
    
    console.log('🚀 PlayDay Admin Form: Загрузка данных для', profile.email);
    
    // Загружаем данные локации из API
    $.ajax({
      url: `${PLAYDAY_API_URL}/${encodeURIComponent(profile.email)}`,
      method: 'GET',
      dataType: 'json',
      success: function(data) {
        if (!data || !data.records || data.records.length === 0) {
          console.warn('⚠️ PlayDay Admin Form: Данные не найдены, форма будет пустой');
          block.show();
          return;
        }
        
        const record = data.records[0];
        console.log('✅ PlayDay Admin Form: Данные получены', record);
        
        // Заполняем форму
        fillForm(block, record);
        
        // Показываем форму
        block.show();
        window.dispatchEvent(new Event('resize'));
      },
      error: function(xhr, status, error) {
        console.error('❌ PlayDay Admin Form: Ошибка загрузки данных', error);
        block.text('Ошибка загрузки данных: ' + error);
        block.css('text-align', 'center').show();
      }
    });
  });
  
  /**
   * Заполняет форму данными из API
   */
  function fillForm(block, record) {
    // Заполняем заголовок и описание формы (если есть)
    if (record.название) {
      block.find('.t-section__title').text(record.название);
    }
    
    if (record.описание) {
      block.find('.t-section__descr').html(record.описание);
    }
    
    // Обходим все поля формы
    block.find('.t-input-group').each(function() {
      const item = $(this);
      
      // Текстовые поля (email, name, input, url, date, time, range, quantity)
      if (item.hasClass('t-input-group_em') ||
          item.hasClass('t-input-group_nm') ||
          item.hasClass('t-input-group_in') ||
          item.hasClass('t-input-group_ur') ||
          item.hasClass('t-input-group_da') ||
          item.hasClass('t-input-group_tm') ||
          item.hasClass('t-input-group_rg') ||
          item.hasClass('t-input-group_qn')) {
        
        const input = item.find('input');
        const field = input.attr('name');
        
        if (field && field in record && record[field] !== null) {
          input.val(record[field]);
          input.trigger('change');
          input.trigger('keyup');
        }
      }
      
      // Телефонные поля
      else if (item.hasClass('t-input-group_ph')) {
        const input = item.find('input').last();
        const field = input.attr('name');
        
        if (field && field in record && record[field] !== null) {
          const input_phonemask = item.find('.t-input-phonemask');
          
          if (input_phonemask.length) {
            const phone_number = String(record[field]).replace(/[^0-9]/g, '');
            
            // Определяем код страны
            item.find('.t-input-phonemask__options-item').each(function() {
              let phone_code = String($(this).attr('data-phonemask-code')).replace(/[^0-9]/g, '');
              if (phone_code && phone_number.startsWith(phone_code)) {
                $(this).click();
              }
            });
            
            input_phonemask.val(record[field]);
            input_phonemask.trigger('input');
            input_phonemask.get(0).dispatchEvent(new Event('input'));
          } else {
            input.val(record[field]);
            input.trigger('change');
          }
        }
      }
      
      // Textarea
      else if (item.hasClass('t-input-group_ta')) {
        const textarea = item.find('textarea');
        const field = textarea.attr('name');
        
        if (field && field in record && record[field] !== null) {
          textarea.val(record[field]);
        }
      }
      
      // Select
      else if (item.hasClass('t-input-group_sb')) {
        const select = item.find('select');
        const field = select.attr('name');
        
        if (field && field in record && record[field] !== null) {
          select.val(record[field]);
        }
      }
      
      // Checkbox
      else if (item.hasClass('t-input-group_cb')) {
        const input = item.find('input');
        const field = input.attr('name');
        
        if (field && field in record && record[field] !== null) {
          input.prop('checked', !!record[field]);
        }
      }
      
      // Radio buttons
      else if (item.hasClass('t-input-group_rd') || item.hasClass('t-input-group_ri')) {
        let field = item.find('input[type="hidden"]').attr('name');
        
        item.find('input').each(function() {
          const input = $(this);
          field = field || input.attr('name');
          const value = input.attr('value');
          
          if (field && field in record && record[field] !== null) {
            const recordValue = String(record[field]);
            if (input.prop('checked') !== recordValue.includes(value)) {
              input[0].click();
            }
          }
        });
      }
      
      // Uploadcare (картинки)
      else if (item.hasClass('t-input-group_uc')) {
        const input = item.find('input');
        const field = input.attr('name');
        
        if (field && field in record && record[field] !== null) {
          // Для одиночной картинки
          if (typeof record[field] === 'string') {
            input.val(record[field]);
          }
          // Для множественных картинок (массив)
          else if (Array.isArray(record[field]) && record[field].length > 0) {
            item.find('.uploadcare--widget__button_type_open').click();
            const url_form = $('.uploadcare--tab_name_url form');
            
            record[field].forEach((photo) => {
              const photoUrl = typeof photo === 'object' ? photo.url : photo;
              url_form.find('input').val(photoUrl);
              url_form.submit();
            });
            
            $('button.uploadcare--panel__done').click();
            $('button.uploadcare--dialog__close').click();
          }
        }
      }
    });
    
    // Скрытые поля
    block.find('.t-form__inputsbox').children('input[type="hidden"]').each(function() {
      const input = $(this);
      const field = input.attr('name');
      
      if (field && field in record && record[field] !== null) {
        input.val(record[field]);
      }
    });
    
    console.log('✅ PlayDay Admin Form: Форма заполнена успешно');
  }
  
})();

