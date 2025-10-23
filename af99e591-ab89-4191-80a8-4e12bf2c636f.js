
        $(document).ready(function () {
            const tool_id = 'af99e591-ab89-4191-80a8-4e12bf2c636f';
            const block_id = '#rec767556113'.substring(4);
            const block = $('#rec767556113').removeClass('r_hidden').hide();
        
            const showdown_url = 'https://cdnjs.cloudflare.com/ajax/libs/showdown/1.9.1/showdown.min.js';
            const tools_runner = 'https://tersvdkiy8.execute-api.eu-central-1.amazonaws.com/prod/tools-runner';
            const project_id = $('#allrecords').attr('data-tilda-project-id');
            const profile = JSON.parse(
                localStorage.getItem(`tilda_members_profile${project_id}`) ||
                localStorage.getItem('memberarea_profile') ||                
                '{}'
            );
            profile['login'] = encodeURIComponent(profile['login']);
            ['groups', 'courses'].forEach(key => delete profile[key]);            
            const filters = new URLSearchParams(window.location.search).get('filters' + block_id);
        
            $.post(
                tools_runner,
                JSON.stringify({
                    tool_id: tool_id,
                    profile: profile,
                    project_id: project_id,
                    referer: document.location.origin,
                    user_agent: navigator.userAgent,
                    filters: filters,
                }),
                function (data) {
                    if ('error' in data) {
                        block.text('Collabza error (#rec767556113): ' + data.error);
                        block.css('text-align', 'center').show();
                        return;
                    }
                    if (data.records.length > 0) {
                        $.getScript(showdown_url, function() {
                            const converter = new showdown.Converter();
                            const record = data.records[0];
                            if ('title' in record) {
                                block.find('.t-section__title').text(record.title);
                            }
                            if ('description' in record) {
                                let description = block.find('.t-section__descr');
                                description.html(converter.makeHtml(String(record.description)));
                                description.find('blockquote').css({
                                    'white-space': 'normal',
                                    'border-left': '3px solid #333333',
                                    'padding-left': '20px'
                                });
                            }
                            if ('data_success_url' in record) {
                                block.find('#form' + block_id).attr('data-success-url', record.data_success_url);
                            }
                            block.find('.t-input-group').each(function( index ) {
                                const item = $(this);
                                if (item.hasClass('t-input-group_em') ||
                                        item.hasClass('t-input-group_nm') ||
                                        item.hasClass('t-input-group_in') ||
                                        item.hasClass('t-input-group_ur') ||
                                        item.hasClass('t-input-group_da') ||
                                        item.hasClass('t-input-group_tm') ||
                                        item.hasClass('t-input-group_rg') ||
                                        item.hasClass('t-input-group_qn')
                                ) {
                                    const input = item.find('input');
                                    const field = input.attr('name');
                                    if (field && field in record) {
                                        input.val(record[field]);
                                        input.trigger('change');
                                        input.trigger('keyup');
                                    }
                                } else if (item.hasClass('t-input-group_ph')) {
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
                                } else if (item.hasClass('t-input-group_ta')) {
                                    const textarea = item.find('textarea');
                                    const field = textarea.attr('name');
                                    if (field && field in record) {
                                        textarea.val(record[field]);
                                    }
                                } else if (item.hasClass('t-input-group_sb')) {
                                    const select = item.find('select');
                                    const field = select.attr('name');
                                    if (field && field in record) {
                                        select.val(record[field]);
                                    }
                                } else if (item.hasClass('t-input-group_cb')) {
                                    const input = item.find('input');
                                    const field = input.attr('name');
                                    if (field && field in record) {
                                        input.prop('checked', record[field]);
                                    }
                                } else if (
                                    item.hasClass('t-input-group_rd')
                                        || item.hasClass('t-input-group_ri')
                                ) {
                                    let field = item.find('input[type="hidden"]').attr('name');
                                    item.find('input').each(function( index ) {
                                        const input = $(this);
                                        field = field || input.attr('name');
                                        const value = input.attr('value');
                                        if (field && field in record && input.prop('checked') !== record[field].includes(value)) {
                                            input[0].click();
                                        }
                                    });
                                } else if (item.hasClass('t-input-group_uc')) {
                                    const input = item.find('input');
                                    const field = input.attr('name');
                                    if (field && field in record && Array.isArray(record[field])) {
                                        item.find('.uploadcare--widget__button_type_open').click();
                                        url_form = $('.uploadcare--tab_name_url form');
                                        record[field].forEach((photo) => {
                                            url_form.find('input').val(photo.url);
                                            url_form.submit();
                                        });
                                        $('button.uploadcare--panel__done').click();
                                        $('button.uploadcare--dialog__close').click();
                                    }
                                }
                            });
                            block.find('.t-form__inputsbox').children('input[type="hidden"]').each(function () {
                                const input = $(this);
                                const field = input.attr('name');
                                if (field && field in record) {
                                    input.val(record[field]);
                                }
                            });
                        });
                    }
                    block.show();
                    window.dispatchEvent(new Event('resize'));
                },
            );
        });
        