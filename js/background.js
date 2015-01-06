// background.js
var socket;
var repeatTimer;
function init(details) {
    initSocket();
}

function initSocket() {
    socket = io('http://127.0.0.1:8888', {'forceNew': true});
    console.log(socket);
    socket.on('connect', cbConnect);
    socket.on('error', cbError);
    socket.on('login_success', cbLoginSuccess);
    socket.on('unseen_result', cbUnseenResult);
    socket.on('mail_info_result', cbMailInfoResult);
    socket.on('server_error', cbServerError);
    socket.on('disconnect', cbDisconnect);
}

function cbConnect(data) {
    console.log('connection!');
    login();
}

function cbError(data) {
    console.log('error!');
    console.log(data);
}

function cbLoginSuccess(data) {
    console.log('login_success!');
    socket.emit('unseen');
}

function cbUnseenResult(data) {
    console.log(data);
    if (data.unseen.length == 0) {
        chrome.browserAction.setIcon({path:"daummail_not_logged_in.png"});
        chrome.browserAction.setBadgeBackgroundColor({color:[190, 190, 190, 230]});
    } else {
        chrome.browserAction.setIcon({path:"daummail_logged_in.png"});
        chrome.browserAction.setBadgeBackgroundColor({color:[208, 0, 24, 255]});
    }
    chrome.browserAction.setBadgeText({text: data.unseen.length + ''});

    // 로컬에 저장된 것과 바뀐 번호 찾기.
    var unseen = data.unseen;
    if (unseen.length > 0) {
        chrome.storage.local.get(['mail_ids'], function(result) {
            var mail_ids = (result.mail_ids) ? result.mail_ids : [];
            var unnoti_mail_id = 0;
            for (var i = unseen.length - 1; i >= 0; i--) {
                if ($.inArray(unseen[i], mail_ids) == -1) {
                    unnoti_mail_id = unseen[i];
                    break;
                }
            }
            chrome.storage.local.set({mail_ids: unseen}, function() {
                if (unnoti_mail_id != 0) {
                    socket.emit('mail_info', {id: unnoti_mail_id});
                }
            });
        });
    }

    // 재요청.
    window.clearTimeout(repeatTimer);
    repeatTimer = window.setTimeout(function() {
        socket.emit('unseen');
    }, 10000);
}

function cbMailInfoResult(data) {
    console.log(data);
    var options = {
        type: 'basic',
        title: data.from,
        message: data.subject,
        iconUrl: 'icon_128.png'
    };
    chrome.notifications.create('mail_noti' + data.id, options, function() {
        console.log('noti!');
    });
}

function cbServerError(data) {
    console.log('server_error!');
    console.log(data);
}

function cbDisconnect(data) {
    console.log('disconnect!');
    console.log(data);
    window.clearTimeout(repeatTimer);
    chrome.browserAction.setIcon({path:"daummail_not_logged_in.png"});
    chrome.browserAction.setBadgeBackgroundColor({color:[190, 190, 190, 230]});
    chrome.browserAction.setBadgeText({text:"?"});

    // 서버에서 끊어진 경우 소켓 다시 초기화.
    if (data == 'io server disconnect') {
        setTimeout(function() {
            initSocket();
        }, 3000);
    }
}

function login() {
    chrome.storage.local.get(['id', 'pw', 'imap_server', 'imap_port', 'imap_tls'], function(result) {
        console.log(result);
        if (!result.id || !result.pw || !result.imap_server || !result.imap_port || !result.imap_tls) {
            return;
        }
        socket.emit('login', {id:result.id, pw:result.pw, imap_server:result.imap_server, imap_port:result.imap_port, imap_tls:result.imap_tls});
    });
}

// 메일 노티와 확장버튼 클릭 시
function clickMail() {
    console.log('clickMail!');
    chrome.storage.local.get(['mail_url'], function(result) {
        if (result.mail_url) {
            chrome.tabs.getAllInWindow(undefined, function(tabs) {
                for (var i = 0, tab; tab = tabs[i]; i++) {
                    if (tab.url && tab.url.indexOf(result.mail_url) >= 0) {
                        console.log('Found WebMail tab: ' + tab.url + '. ' +
                            'Focusing and refreshing count...');
                        chrome.tabs.update(tab.id, {selected: true});
                        return;
                    }
                }
                console.log('Could not find WebMail tab. Creating one...');
                chrome.tabs.create({url: result.mail_url});
            });
        }
    });
}
chrome.runtime.onInstalled.addListener(init);
chrome.runtime.onStartup.addListener(init);

// 버튼 클릭 시
chrome.browserAction.onClicked.addListener(clickMail);
// 노티 클릭 시
chrome.notifications.onClicked.addListener(clickMail);