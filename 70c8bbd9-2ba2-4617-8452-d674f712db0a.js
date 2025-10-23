
        $(document).ready(function () {
            const tool_id = '70c8bbd9-2ba2-4617-8452-d674f712db0a';
            const block_id = '#rec762597856'.substring(4);
            const block = $('#rec762597856').removeClass('r_hidden');

            block.wrap(`<div id="rec${block_id}" class="r"></div>`).remove();
            block.removeClass('r');
            const container = $(`#rec${block_id}`);
        
            const tools_runner = 'https://tersvdkiy8.execute-api.eu-central-1.amazonaws.com/prod/tools-runner';
            const project_id = $('#allrecords').attr('data-tilda-project-id');
            const profile = JSON.parse(
                localStorage.getItem(`tilda_members_profile${project_id}`) ||
                localStorage.getItem('memberarea_profile') ||                
                '{}'
            );
            profile['login'] = encodeURIComponent(profile['login']);
            ['groups', 'courses'].forEach(key => delete profile[key]);            
            const filters = new URLSearchParams(window.location.search).get(`filters${block_id}`);
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
                        container.text('Collabza error (#rec762597856): ' + data.error);
                        container.css('text-align', 'center');
                        return;
                    }
                    data.records.forEach(function (record, index) {
                        item = block.clone(true).attr('id', `rec${block_id}_${index}`);
                        if ('html' in record) {
                            item.find('.t123 > div > div').html(record.html)
                        }
                        item.appendTo(container);
                        $(window).trigger('resize');
                        window.dispatchEvent(new Event('resize'));
                    });
                    container.trigger('collabza_loaded');
                },
            );
        });
        