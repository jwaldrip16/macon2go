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
  function ffPushState(state, hint){
    // One-line status on the app: green = this phone will get alerts even closed.
    try {
      var el = document.getElementById('ffPushState');
      if (!el){
        el = document.createElement('div');
        el.id = 'ffPushState';
        el.style.cssText = 'position:fixed;left:0;right:0;bottom:0;background:#0b3d24;color:#fff;padding:8px 14px;z-index:9997;display:flex;gap:10px;align-items:center;justify-content:center;font-size:13px;text-align:center';
        var add = function(){ (document.body || document.documentElement).appendChild(el); };
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', add); else add();
      }
      el.textContent = state;
      el.title = hint || '';
      if (state.indexOf('Notifications on') === 0){
        // good news only: the "all set" line clears itself after 5 seconds, warnings stay
        setTimeout(function(){ if (el && el.parentNode) el.parentNode.removeChild(el); }, 5000);
      }
    } catch(e){}
  }
  function ensure(){
    if (Notification.permission === 'denied'){
      ffPushState('Notifications are turned off on this phone. Android Settings > Apps > ' +
        (role === 'driver' ? 'Fleet Foot Driver' : 'Fleet Foot Restaurant') + ' > Notifications, turn them on, then reopen the app.');
      return;
    }
    return fetch('/api/push/key').then(r => r.json()).then(function(k){
      if (!k.ok || !k.key) return;
      return navigator.serviceWorker.ready.then(function(reg){
        return reg.pushManager.getSubscription().then(function(sub){
          if (sub) return sub;
          return reg.pushManager.subscribe({userVisibleOnly: true,
                                            applicationServerKey: b64ToUint8(k.key)});
        });
      }).then(function(sub){
        if (!sub){ ffPushState('Notifications could not be set up on this phone.'); return; }
        var j = sub.toJSON();
        return post('/api/push/subscribe',
                    {subscription: {endpoint: j.endpoint, keys: j.keys}, role: role})
          .then(function(resp){
            if (resp && resp.ok){ ffPushState('Notifications on. This phone gets alerts even with the app closed.'); }
            else { ffPushState('Notifications ready, but sign in first so the phone can register.'); }
          });
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
