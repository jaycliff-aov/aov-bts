if (
    typeof Element === "function" &&
    typeof Element.prototype.on !== "function" &&
    typeof Element.prototype.off !== "function" &&
    typeof Element.prototype.one !== "function"
) {
    Element.prototype.on = function on(event_name, listener, meta) {
        "use strict";
        var list, k, len;
        if (typeof event_name !== "string" || typeof listener !== "function") {
            throw new TypeError('Invalid parameters passed.');
        }
        list = event_name.split(' ');
        for (k = 0, len = list.length; k < len; k += 1) {
            this.addEventListener(list[k], listener, meta || false);
        }
        return this;
    };
    Element.prototype.off = function off(event_name, listener, meta) {
        "use strict";
        var list, k, len;
        if (typeof event_name !== "string" || typeof listener !== "function") {
            throw new TypeError('Invalid parameters passed.');
        }
        list = event_name.split(' ');
        for (k = 0, len = list.length; k < len; k += 1) {
            this.removeEventListener(list[k], listener, meta || false);
        }
        return this;
    };
    Element.prototype.one = (function (noop) {
        "use strict";
        var surrogate_pool = (function () {
            var pool = [];
            function recycle() {
                this._listener = noop;
                this._meta = false;
                pool.push(this);
            }
            // window.one_pool = pool;
            return {
                summon(listener, meta) {
                    var surrogate;
                    if (pool.length) {
                        surrogate = pool.pop();
                    } else {
                        surrogate = function surrogate(event) {
                            surrogate._listener.call(this, event);
                            this.removeEventListener(event.type, surrogate, surrogate._meta);
                            surrogate._recycle();
                        };
                        surrogate._recycle = recycle;
                    }
                    surrogate._listener = listener;
                    surrogate._meta = meta || false;
                    return surrogate;
                }
            };
        }());
        return function one(event_name, listener, meta) {
            "use strict";
            var list, k, len;
            if (typeof event_name !== "string" || typeof listener !== "function") {
                throw new TypeError('Invalid parameters passed.');
            }
            list = event_name.split(' ');
            meta = meta || false;
            for (k = 0, len = list.length; k < len; k += 1) {
                this.addEventListener(list[k], surrogate_pool.summon(listener, meta), meta);
            }
            return this;
        };
    }(Function.prototype));
}
if (typeof Date.prototype.getDateString !== "function") {
    Date.prototype.getDateString = function getDateString() {
        "use strict";
        var mm = this.getMonth() + 1; // getMonth() is zero-based
        var dd = this.getDate();
        return [this.getFullYear(),
            (mm>9 ? '' : '0') + mm,
            (dd>9 ? '' : '0') + dd
            ].join('\/');
    };
}
if (typeof Date.prototype.addDays !== "function") {
    Date.prototype.addDays = function addDays(days) {
        "use strict";
        var date = new Date(this.valueOf());
        date.setDate(date.getDate() + days);
        return date;
    };
}
document.addEventListener('DOMContentLoaded', function () {
    "use strict";
    var hasOwnProperty = Object.prototype.hasOwnProperty, exportCSV;
    var form_element = document.getElementById('wrapper'),
        list_of_day_names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        output_keys = ['Employee Number', 'Mode', 'Datetime', 'Company Alias'],
        company_alias_string = 'Eversun Software Philippines Corp. Davao',
        start_date_element = form_element.querySelector('#duration input[name="start_date"]'),
        end_date_element = form_element.querySelector('#duration input[name="end_date"]'),
        sd_object = null,
        reset_button = form_element.querySelector('#duration button.reset'),
        agent_data_element = document.getElementById('agent-data'),
        ad_file_input = agent_data_element.querySelector('input'),
        ad_csv = null,
        schedule_element = document.getElementById('schedule'),
        s_file_input = schedule_element.querySelector('input'),
        s_csv = null,
        list_of_agents_data,
        list_of_schedule_data,
        map_of_schedule_data = Object.create(null);
    list_of_day_names.forEach(function (v, i, list) {
        list[i] = v.toLowerCase();
    });
    // console.log(day_names);
    // date_string.replace(/-/g, '\/')
    function resetValidation(no_report) {
        if (!this.checkValidity()) {
            this.setCustomValidity('');
            !no_report && this.reportValidity();
            console.log('reset custom validation message');
        }
    }
    function resetSystem() {
        start_date_element.value = '';
        resetValidation.call(start_date_element, true);
        end_date_element.value = '';
        resetValidation.call(end_date_element, true);
        if (ad_file_input.value) {
            ad_file_input.value = '';
            agent_data_element.className = '';
        }
        if (s_file_input.value) {
            s_file_input.value = '';
            schedule_element.className = '';
        }
        ad_csv = null;
        s_csv = null;
        sd_object = null;
        map_of_schedule_data = Object.create(null);
    }
    function removeEmptyRows(list) {
        var k, len, item;
        for (k = 0, len = list.length; k < len; k += 1) {
            item = list[k];
            if (!item.join('').trim()) {
                list.splice(k, 1);
                k -= 1;
                len -= 1;
            }
        }
    }
    function formatKeys(keys) {
        var k, len, key, history = Object.create(null);
        for (k = 0, len = keys.length; k < len; k += 1) {
            key = keys[k];
            if (hasOwnProperty.call(history, key)) {
                key += history[key];
                history[key] += 1;
            } else {
                history[key] = 1;
            }
            keys[k] = key.toLowerCase().trim();
        }
    }
    function formatEntries(keys, reflist) {
        var k1, len1, k2, len2, item, obj, list = [];
        for (k1 = 0, len1 = reflist.length; k1 < len1; k1 += 1) {
            item = reflist[k1];
            obj = Object.create(null);
            for (k2 = 0, len2 = item.length; k2 < len2; k2 += 1) {
                obj[keys[k2]] = item[k2];
            }
            list.push(obj);
        }
        return list;
    }
    function to24(time) {
        var hours = Number(time.match(/^(\d+)/)[1]),
            minutes = Number(time.match(/:(\d+)/)[1]),
            am_pm = time.match(/\s(.*)$/)[1],
            s_hours, s_minutes;
        if (am_pm === "PM" && hours < 12) {
            hours = hours + 12;
        }
        if (am_pm === "AM" && hours === 12) {
            hours = hours - 12;
        }
        s_hours = hours.toString();
        s_minutes = minutes.toString();
        if (hours < 10) {
            s_hours = "0" + s_hours;
        }
        if (minutes < 10) {
            s_minutes = "0" + s_minutes;
        }
        return s_hours + ":" + s_minutes;
    }
    function formatSchedule(list) {
        var k, len, item, key;
        for (k = 0, len = list.length; k < len; k += 1) {
            item = list[k];
            for (key in item) {
                // item[key] = item[key].replace('AM', '').trim();
                // console.log(item[key]);
                item[key] = to24(item[key]);
            }
        }
    }
    function handleFile(type, file) {
        console.log(file);
        Papa.parse(file, {
            complete(results) {
                var data = results.data, keys = data.splice(0, 1)[0], formatted_data, k, len, item;
                formatKeys(keys);
                removeEmptyRows(data);
                switch (type) {
                    case 'ad': {
                        ad_csv = file;
                        formatted_data = formatEntries(keys, data);
                        list_of_agents_data = formatted_data;
                        console.log(keys, formatted_data);
                        agent_data_element.classList.add('filled');
                        agent_data_element.dataset.text = file.name;
                        break;
                    }
                    case 's': {
                        s_csv = file;
                        keys[0] = 'index';
                        formatted_data = formatEntries(keys, data);
                        list_of_schedule_data = formatted_data;
                        for (k = 0, len = list_of_schedule_data.length; k < len; k += 1) {
                            item = list_of_schedule_data[k];
                            map_of_schedule_data[item.index] = item;
                            delete item.index;
                        }
                        formatSchedule(formatted_data);
                        schedule_element.classList.add('filled');
                        schedule_element.dataset.text = file.name;
                        console.log(keys, formatted_data, map_of_schedule_data);
                        break;
                    }
                }
            }
        });
    }
    function getDays(start, end) {
        var oneDay = 24 * 60 * 60 * 1000, // hours * minutes * seconds * milliseconds
            firstDate = new Date(start),
            secondDate = new Date(end),
            // diffDays = Math.round(Math.abs((firstDate - secondDate) / oneDay)),
            diffDays = Math.round((secondDate - firstDate) / oneDay);
        return diffDays + 1;
    }
    function agentDataEventHandler(event) {
        var prevent_default = true;
        switch (event.type) {
            case 'dragenter': {
                this.classList.add('highlight');
                break;
            }
            case 'drop': {
                let dt = event.dataTransfer, files = dt.files;
                switch (this) {
                    case agent_data_element: {
                        handleFile('ad', files[0]);
                        break;
                    }
                    case schedule_element: {
                        handleFile('s', files[0]);
                        break;
                    }
                }
                this.querySelector('input[type="file"').files = files;
                // console.log(files);
                /* falls through */
            }
            case 'dragleave': {
                this.classList.remove('highlight');
                console.log('LEAVING SO EARLY?');
                break;
            }
            case 'dragover': {

                break;
            }
            case 'click': {
                switch (this) {
                    case agent_data_element: {
                        if (!ad_csv) {
                            prevent_default = false;
                        }
                        break;
                    }
                    case schedule_element: {
                        if (!s_csv) {
                            prevent_default = false;
                        }
                        break;
                    }
                }
                break;
            }
        }
        if (event.cancelable && prevent_default) {
            // console.log('Prevent default for', event.type);
            event.preventDefault();
        }
        event.stopPropagation();
    }
    // https://stackoverflow.com/questions/14964035/how-to-export-javascript-array-info-to-csv-on-client-side
    exportCSV = (function () {
        var link = document.createElement("a");
        link.setAttribute('style', 'display: none;');
        document.body.appendChild(link); // Required for FF
        return function exportCSV(csv_content) {
            var encoded_uri = encodeURI(csv_content);
            link.setAttribute("href", encoded_uri);
            link.setAttribute("download", "bts_output.csv");
            link.click(); // This will download the data file named "my_data.csv".
        };
    }());
    reset_button.on('click', resetSystem, false);
    start_date_element.on('change', function () {
        sd_object = new Date(this.value);
        console.log(this.value);
    }, false);
    end_date_element.on('change', function () {
        resetValidation.call(this);
        console.log(this.value);
    }, false);
    form_element.on('submit', function (event) {
        var days = getDays(start_date_element.value, end_date_element.value),
            list, k1, len1, k2, len2, agent, date_obj, date, day, key, mode, schedule,
            employee_id;
        console.log('days', days);
        if (days < 1) {
            end_date_element.setCustomValidity('End date should either be on or after the starting date.');
            end_date_element.reportValidity();
        }
        list = [];
        list.push(output_keys); // header
        for (k1 = 0, len1 = days; k1 < len1; k1 += 1) {
            if (k1 > 0) {
                date_obj = sd_object.addDays(k1);
                date = date_obj.getDateString();
            } else {
                date_obj = sd_object;
                date = sd_object.getDateString();
            }
            day = list_of_day_names[date_obj.getDay()];
            // console.log(day);
            for (k2 = 0, len2 = list_of_agents_data.length; k2 < len2; k2 += 1) {
                agent = list_of_agents_data[k2];
                employee_id = agent['id number'];
                mode = agent[day];
                if (mode) {
                    schedule = map_of_schedule_data[mode];
                    for (key in schedule) {
                        if (hasOwnProperty.call(schedule, key)) {
                            list.push([employee_id, mode, date + ' ' + schedule[key], company_alias_string]);
                        }
                    }
                }
            }
        }
        exportCSV("data:text/csv;charset=utf-8," + Papa.unparse(list));
        // console.log(list, csv);
        if (event.cancelable) {
            event.preventDefault();
        }
    }, false);
    agent_data_element.on('click dragenter dragleave dragover drop', agentDataEventHandler, false);
    schedule_element.on('click dragenter dragleave dragover drop', agentDataEventHandler, false);
    ad_file_input.addEventListener('change', function (event) {
        handleFile('ad', this.files[0]);
    }, false);
    s_file_input.addEventListener('change', function (event) {
        handleFile('s', this.files[0]);
    }, false);
    // this.addEventListener('drop', function (event) {
    //     console.log(event.type, 'on', this);
    //     event.preventDefault();
    // }, false);
}, false);