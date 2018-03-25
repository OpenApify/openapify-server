// This is an example using openapify

var request = require('request');
var JSONfn = require('jsonfn').JSONfn;

request({
    url: 'http://localhost:8000/sync',
    method: 'POST',
    headers: {
        'content-type': 'application/json',
    },
    body: JSONfn.stringify({
        "Url": "https://status.github.com/",
        "Scripts": [
            "https://code.jquery.com/jquery-3.3.1.min.js",
        ],
        "Function": function(){
            var $ = window.$;
            let messages = [];
            $('.message').each((_, message) => {
                messages.push({
                    Time: $(message).find('time').attr('datetime'),
                    Title: $(message).find('.title').text().trim(),
                });
            });
            return messages;
        },
    }),
}, (error, response, body) => {
    console.log(body);
});