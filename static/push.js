// Web push for the driver and kitchen apps: registers the phone once, then
// dispatch and system events reach it even when the app is closed.
(function(){
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return;
  var role = null;
  if (/^\/(driver|go\/driver)/.test(location.pathname)) role = 'driver';
  else if (/^\/(restaurant|go\/kitchen)/.test(location.pathname)) role = 'kitchen';
  if (!role) return;
  function b64ToUint8(b64){
    var pad = '='.repeat((4 - b64.length % 4) % 4);
    var base = (b64 + pad).replace(/-/g, '+').replace(/_/g, '/');
    var raw = atob(base);
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }
  function post(url, body){
    return fetch(url, {method: 'POST', headers: {'Content-Type': 'application/json'},
                       body: JSON.stringify(body)}).then(r => r.json()).catch(() => ({}));
  }
  function ensure(){
    return fetch('/api/push/key').then(r => r.json()).then(function(k){
      if (!k.ok || !k.key) return;
      return navigator.serviceWorker.ready.then(function(reg){
        return reg.pushManager.getSubscription().then(function(sub){
          if (sub) return sub;
          return reg.pushManager.subscribe({userVisibleOnly: true,
                                            applicationServerKey: b64ToUint8(k.key)});
        });
      }).then(function(sub){
        if (!sub) return;
        var j = sub.toJSON();
        return post('/api/push/subscribe',
                    {subscription: {endpoint: j.endpoint, keys: j.keys}, role: role});
      });
    }).catch(function(){});
  }
  if (Notification.permission === 'granted'){ ensure(); }
  else if (Notification.permission === 'default'){
    // The green bar in base.html asks for permission; pick up as soon as it's granted.
    var t = setInterval(function(){
      if (Notification.permission !== 'default'){
        clearInterval(t);
        if (Notification.permission === 'granted') ensure();
      }
    }, 1500);
    setTimeout(function(){ clearInterval(t); }, 60000);
  }
  window.ffPush = {ensure: ensure};
})();
