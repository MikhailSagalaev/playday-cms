/**
 * PlayDay CMS Integration Script для Tilda
 * Заменяет скрипт Collabza (af99e591-ab89-4191-80a8-4e12bf2c636f.js)
 * 
 * Использование:
 * 1. Замените YOUR_API_URL на URL вашего API сервера
 * 2. Добавьте этот скрипт в HTML-блок Tilda (Zero Block или T123)
 * 3. Настройте CORS на вашем API сервере для домена Tilda
 */

$(document).ready(function () {
    // Конфигурация
    const API_URL = 'https://your-api-domain.com/api/tilda/fetch-content'; // ЗАМЕНИТЕ НА ВАШ URL
    const block_id = '#rec767556113'.substring(4); // ID блока Tilda
    const block = $('#rec767556113').removeClass('r_hidden').hide();
    
    // Получаем ID проекта Tilda
    const project_id = $('#allrecords').attr('data-tilda-project-id');
    
    // Получаем профиль пользователя из localStorage (как в оригинальном Collabza)
    const profile = JSON.parse(
        localStorage.getItem(`tilda_members_profile${project_id}`) ||
        localStorage.getItem('memberarea_profile') ||                
        '{}'
    );
    
    // Кодируем login для безопасности
    profile['login'] = encodeURIComponent(profile['login']);
    
    // Удаляем ненужные поля
    ['groups', 'courses'].forEach(key => delete profile[key]);
    
    // Получаем фильтры из URL
    const filters = new URLSearchParams(window.location.search).get('filters' + block_id);
    
    // Проверяем, что у нас есть необходимые данные профиля
    if (!profile.login || !profile.email) {
        block.text('Ошибка: Неполный профиль пользователя. Пожалуйста, войдите в личный кабинет.');
        block.css('text-align', 'center').show();
        return;
    }
    
    // Загружаем showdown для конвертации Markdown в HTML
    const showdown_url = 'https://cdnjs.cloudflare.com/ajax/libs/showdown/1.9.1/showdown.min.js';
    
    // Выполняем запрос к API
    $.post(
        API_URL,
        JSON.stringify({
            profile: profile,
            project_id: project_id,
            referer: document.location.origin,
            user_agent: navigator.userAgent,
            filters: filters,
        }),
        function (data) {
            if ('error' in data) {
                block.text('Ошибка загрузки данных: ' + data.error);
                block.css('text-align', 'center').show();
                return;
            }
            
            if (data.records && data.records.length > 0) {
                // Загружаем showdown если нужно
                if (typeof showdown === 'undefined') {
                    $.getScript(showdown_url, function() {
                        processRecords(data.records);
                    });
                } else {
                    processRecords(data.records);
                }
            } else {
                block.text('Данные не найдены. Обратитесь к администратору.');
                block.css('text-align', 'center').show();
            }
        },
        'json'
    ).fail(function(xhr, status, error) {
        console.error('Ошибка запроса к API:', error);
        block.text('Ошибка подключения к серверу. Попробуйте позже.');
        block.css('text-align', 'center').show();
    });
    
    /**
     * Обработка полученных записей
     */
    function processRecords(records) {
        const record = records[0]; // Берем первую запись
        
        // Инициализируем конвертер Markdown
        const converter = new showdown.Converter();
        
        // Заполняем основные поля
        if (record.title) {
            block.find('.t-section__title').text(record.title);
        }
        
        if (record.description) {
            let description = block.find('.t-section__descr');
            const htmlContent = converter.makeHtml(String(record.description));
            description.html(htmlContent);
            
            // Стилизация blockquote
            description.find('blockquote').css({
                'white-space': 'normal',
                'border-left': '3px solid #333333',
                'padding-left': '20px'
            });
        }
        
        // Заполняем поля формы (аналогично оригинальному Collabza)
        block.find('.t-input-group').each(function( index ) {
            const item = $(this);
            
            // Обработка различных типов полей
            if (item.hasClass('t-input-group_em') || // Email
                item.hasClass('t-input-group_nm') || // Name
                item.hasClass('t-input-group_in') || // Input
                item.hasClass('t-input-group_ur') || // URL
                item.hasClass('t-input-group_da') || // Date
                item.hasClass('t-input-group_tm') || // Time
                item.hasClass('t-input-group_rg') || // Range
                item.hasClass('t-input-group_qn')    // Question
            ) {
                const input = item.find('input');
                const field = input.attr('name');
                if (field && field in record) {
                    input.val(record[field]);
                    input.trigger('change');
                    input.trigger('keyup');
                }
            } 
            // Обработка телефонных полей
            else if (item.hasClass('t-input-group_ph')) {
                const input = item.find('input').last();
                const field = input.attr('name');
                if (field && field in record) {
                    const input_phonemask = item.find('.t-input-phonemask');
                    if (input_phonemask.length) {
                        const phone_number = String(record[field]).replace(/[^0-9]/g,'');
                        item.find('.t-input-phonemask__options-item').each(function( index, element ) {
                            let phone_code = String($(element).attr('data-phonemask-code')).replace(/[^0-9]/g,'');
                            if (phone_code && phone_number.startsWith(phone_code)) {
                                $(element).click();
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
            // Обработка textarea
            else if (item.hasClass('t-input-group_ta')) {
                const textarea = item.find('textarea');
                const field = textarea.attr('name');
                if (field && field in record) {
                    textarea.val(record[field]);
                }
            } 
            // Обработка select
            else if (item.hasClass('t-input-group_sb')) {
                const select = item.find('select');
                const field = select.attr('name');
                if (field && field in record) {
                    select.val(record[field]);
                }
            } 
            // Обработка checkbox
            else if (item.hasClass('t-input-group_cb')) {
                const input = item.find('input');
                const field = input.attr('name');
                if (field && field in record) {
                    input.prop('checked', record[field]);
                }
            } 
            // Обработка radio buttons
            else if (item.hasClass('t-input-group_rd') || item.hasClass('t-input-group_ri')) {
                let field = item.find('input[type="hidden"]').attr('name');
                item.find('input').each(function( index ) {
                    const input = $(this);
                    field = field || input.attr('name');
                    const value = input.attr('value');
                    if (field && field in record && input.prop('checked') !== record[field].includes(value)) {
                        input[0].click();
                    }
                });
            } 
            // Обработка загрузки файлов
            else if (item.hasClass('t-input-group_uc')) {
                const input = item.find('input');
                const field = input.attr('name');
                if (field && field in record && Array.isArray(record[field])) {
                    item.find('.uploadcare--widget__button_type_open').click();
                    const url_form = $('.uploadcare--tab_name_url form');
                    record[field].forEach((photo) => {
                        url_form.find('input').val(photo.url);
                        url_form.submit();
                    });
                    $('button.uploadcare--panel__done').click();
                    $('button.uploadcare--dialog__close').click();
                }
            }
        });
        
        // Заполняем скрытые поля
        block.find('.t-form__inputsbox').children('input[type="hidden"]').each(function () {
            const input = $(this);
            const field = input.attr('name');
            if (field && field in record) {
                input.val(record[field]);
            }
        });
        
        // Заполняем специфичные поля для развлекательных центров
        fillEntertainmentFields(record);
        
        // Показываем блок
        block.show();
        window.dispatchEvent(new Event('resize'));
    }
    
    /**
     * Заполнение специфичных полей для развлекательных центров
     */
    function fillEntertainmentFields(record) {
        // Заполняем поля, которые используются в шаблонах развлекательных центров
        
        // Основная информация
        if (record.title) $('.nazvanie .tn-atom').html(record.title);
        if (record.email) $('.email .tn-atom').html(record.email);
        if (record.phone) $('.phone .tn-atom').html(record.phone);
        if (record.cover_image) $('.coverimg .tn-atom__img').attr('src', record.cover_image);
        if (record.address) $('.address .tn-atom').html(record.address);
        
        // Тайм-карты
        if (record['1h-card']) $('.1h-card .tn-atom').html(record['1h-card']);
        if (record['2h-card']) $('.2h-card .tn-atom').html(record['2h-card']);
        if (record['3h-card']) $('.3h-card .tn-atom').html(record['3h-card']);
        if (record['4h-card']) $('.4h-card .tn-atom').html(record['4h-card']);
        if (record['5h-card']) $('.5h-card .tn-atom').html(record['5h-card']);
        
        // Призы
        if (record.prizetxt1) $('.prizetxt1 .tn-atom').html(record.prizetxt1);
        if (record.prizetxt2) $('.prizetxt2 .tn-atom').html(record.prizetxt2);
        if (record.prizetxt3) $('.prizetxt3 .tn-atom').html(record.prizetxt3);
        if (record.prizeimg1) $('.prizeimg1 .tn-atom').css('background-image', 'url(' + record.prizeimg1 + ')');
        if (record.prizeimg2) $('.prizeimg2 .tn-atom').css('background-image', 'url(' + record.prizeimg2 + ')');
        if (record.prizeimg3) $('.prizeimg3 .tn-atom').css('background-image', 'url(' + record.prizeimg3 + ')');
        if (record.prizealltxt) $('.prizealltxt .tn-atom').html(record.prizealltxt);
        if (record.rozegrishtxt) $('.rozegrishtxt .tn-atom').html(record.rozegrishtxt);
        if (record['600']) $('.600 .tn-atom').html(record['600']);
        if (record.nextdate) $('.nextdate .tn-atom').html(record.nextdate);
        
        // Акции
        if (record.akciatxt) $('.akciatxt .tn-atom').html(record.akciatxt);
        if (record.skidka1) $('.skidka1 .tn-atom').html(record.skidka1);
        if (record.skidka2) $('.skidka2 .tn-atom').html(record.skidka2);
        
        // Цены
        if (record['time-card1']) $('.time-card1 .tn-atom').html(record['time-card1'] + ' руб.');
        if (record['time-card2']) $('.time-card2 .tn-atom').html(record['time-card2'] + ' руб.');
        if (record['time-card3']) $('.time-card3 .tn-atom').html(record['time-card3'] + ' руб.');
        if (record['time-card4']) $('.time-card4 .tn-atom').html(record['time-card4'] + ' руб.');
        if (record['time-card5']) $('.time-card5 .tn-atom').html(record['time-card5'] + ' руб.');
        if (record.every30) $('.every30 .tn-atom').html(record.every30);
        
        // Система лояльности
        if (record.vznos1) $('.vznos1 .tn-atom').html(record.vznos1 + ' руб.');
        if (record.vznos2) $('.vznos2 .tn-atom').html(record.vznos2 + ' руб.');
        if (record.vznos3) $('.vznos3 .tn-atom').html(record.vznos3 + ' руб.');
        if (record.vznos4) $('.vznos4 .tn-atom').html(record.vznos4 + ' руб.');
        if (record.vznos5) $('.vznos5 .tn-atom').html(record.vznos5 + ' руб.');
        if (record.vznos6) $('.vznos6 .tn-atom').html(record.vznos6 + ' руб.');
        if (record.bonus1) $('.bonus1 .tn-atom').html('+' + record.bonus1);
        if (record.bonus2) $('.bonus2 .tn-atom').html('+' + record.bonus2);
        if (record.bonus3) $('.bonus3 .tn-atom').html('+' + record.bonus3);
        if (record.bonus4) $('.bonus4 .tn-atom').html('+' + record.bonus4);
        if (record.bonus5) $('.bonus5 .tn-atom').html('+' + record.bonus5);
        if (record.bonus6) $('.bonus6 .tn-atom').html('+' + record.bonus6);
        
        // Привилегии
        if (record.privilege1) $('.privilege1 .tn-atom').html(record.privilege1);
        if (record.privilege2) $('.privilege2 .tn-atom').html(record.privilege2);
        if (record.privilege3) $('.privilege3 .tn-atom').html(record.privilege3);
        if (record.privilege4) $('.privilege4 .tn-atom').html(record.privilege4);
    }
});

/**
 * Утилиты для работы с API
 */
window.PlayDayCMS = {
    // Функция для обновления данных
    refresh: function() {
        location.reload();
    },
    
    // Функция для получения текущих данных
    getCurrentData: function() {
        return window.currentPlayDayData || null;
    },
    
    // Функция для отладки
    debug: function() {
        console.log('PlayDay CMS Integration Script loaded');
        console.log('API URL:', 'https://your-api-domain.com/api/tilda/fetch-content');
        console.log('Current data:', window.currentPlayDayData);
    }
};

// Сохраняем данные глобально для доступа
window.currentPlayDayData = null;
