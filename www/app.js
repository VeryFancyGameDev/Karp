/* Karp — local-first Discord-style chat with a friends system.
 * All data lives in localStorage via the `Store` below. To go multi-user,
 * replace Store with calls to your backend (see README). */
(function () {
  'use strict';

  var KEY = 'karp.v1';
  var COLORS = ['#ff6b4a', '#5b8def', '#3ddc97', '#b36bff', '#ff5ca8', '#2fc4d8', '#e6a23c', '#7a8cff'];

  // Demo directory of people you can add (stands in for a real user database).
  var DIRECTORY = [
    { id: 'u_mia', name: 'mia', status: 'online' },
    { id: 'u_leo', name: 'leo', status: 'online' },
    { id: 'u_nova', name: 'nova', status: 'idle' },
    { id: 'u_kai', name: 'kai', status: 'offline' },
    { id: 'u_juno', name: 'juno', status: 'online' },
    { id: 'u_ravi', name: 'ravi', status: 'offline' },
    { id: 'u_zed', name: 'zed', status: 'idle' }
  ];
  var BOT_LINES = ['haha yeah', 'oh nice, tell me more', 'omg same', 'wait really?', 'lol', 'sounds good to me',
    'brb, grabbing food', 'that is actually wild', 'let’s do it', 'no way 😂', 'I was just about to say that'];

  var state, ui = { view: 'home', serverId: null, channelId: null, dmId: null, tab: 'online', menu: false, addMsg: null };

  function uid() { return Math.random().toString(36).slice(2, 10); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function colorFor(str) { var h = 0; for (var i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0; return COLORS[h % COLORS.length]; }
  function person(id) {
    if (id === state.me.id) return state.me;
    for (var i = 0; i < DIRECTORY.length; i++) if (DIRECTORY[i].id === id) return DIRECTORY[i];
    return { id: id, name: 'unknown', status: 'offline' };
  }
  function avatar(p, dot) {
    return '<div class="avatar" style="background:' + colorFor(p.name) + '">' + esc(p.name.charAt(0).toUpperCase()) +
      (dot ? '<span class="dot ' + (p.status || 'offline') + '"></span>' : '') + '</div>';
  }
  function time(ts) { var d = new Date(ts); return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }

  var Store = {
    load: function () { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } },
    save: function () { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ } }
  };

  function seed(name) {
    var now = Date.now();
    var gen = uid(), karp = uid();
    return {
      me: { id: 'me', name: name, status: 'online' },
      servers: [
        { id: 's_karp', name: 'Karp HQ', channels: [
          { id: 'c_general', name: 'general', msgs: [
            { id: uid(), from: 'u_mia', text: 'welcome to Karp 🐟', ts: now - 3600e3 },
            { id: uid(), from: 'u_leo', text: 'the UI is clean, I like it', ts: now - 3000e3 }
          ] },
          { id: 'c_random', name: 'random', msgs: [] },
          { id: 'c_music', name: 'music', msgs: [] }
        ] },
        { id: 's_game', name: 'Game Night', channels: [
          { id: 'c_lobby', name: 'lobby', msgs: [{ id: uid(), from: 'u_juno', text: 'who is up for a match tonight?', ts: now - 900e3 }] },
          { id: 'c_clips', name: 'clips', msgs: [] }
        ] }
      ],
      friends: ['u_mia'],
      incoming: ['u_nova'],
      outgoing: [],
      blocked: [],
      dms: {}
    };
  }

  /* ---------- friends logic ---------- */
  var Friends = {
    isFriend: function (id) { return state.friends.indexOf(id) > -1; },
    sendRequest: function (rawName) {
      var name = rawName.trim().toLowerCase().replace(/^@/, '');
      if (!name) return { ok: false, msg: 'Enter a username.' };
      if (name === state.me.name.toLowerCase()) return { ok: false, msg: 'You can’t add yourself.' };
      var target = DIRECTORY.filter(function (u) { return u.name === name; })[0];
      if (!target) return { ok: false, msg: 'No user named “' + name + '”. Try: ' + DIRECTORY.slice(0, 4).map(function (u) { return u.name; }).join(', ') + '.' };
      if (this.isFriend(target.id)) return { ok: false, msg: 'You’re already friends with ' + target.name + '.' };
      if (state.outgoing.indexOf(target.id) > -1) return { ok: false, msg: 'Request already sent.' };
      if (state.incoming.indexOf(target.id) > -1) { this.accept(target.id); return { ok: true, msg: target.name + ' had already sent you a request — you’re now friends!' }; }
      state.outgoing.push(target.id);
      Store.save();
      // Demo: the other person accepts after a moment.
      setTimeout(function () {
        var i = state.outgoing.indexOf(target.id);
        if (i > -1) { state.outgoing.splice(i, 1); state.friends.push(target.id); Store.save(); render(); }
      }, 4000);
      return { ok: true, msg: 'Friend request sent to ' + target.name + '.' };
    },
    accept: function (id) {
      state.incoming = state.incoming.filter(function (x) { return x !== id; });
      if (!this.isFriend(id)) state.friends.push(id);
      Store.save();
    },
    decline: function (id) { state.incoming = state.incoming.filter(function (x) { return x !== id; }); Store.save(); },
    cancel: function (id) { state.outgoing = state.outgoing.filter(function (x) { return x !== id; }); Store.save(); },
    remove: function (id) { state.friends = state.friends.filter(function (x) { return x !== id; }); Store.save(); }
  };

  function botReply(dmId) {
    var p = person(dmId);
    if (p.status === 'offline') return;
    setTimeout(function () {
      (state.dms[dmId] = state.dms[dmId] || []).push({ id: uid(), from: dmId, text: BOT_LINES[Math.floor(Math.random() * BOT_LINES.length)], ts: Date.now() });
      Store.save(); render(true);
    }, 1200 + Math.random() * 1500);
  }

  /* ---------- views ---------- */
  function currentServer() { return state.servers.filter(function (s) { return s.id === ui.serverId; })[0]; }
  function currentChannel() { var s = currentServer(); return s && s.channels.filter(function (c) { return c.id === ui.channelId; })[0]; }

  function renderMsgs(list) {
    if (!list.length) return '<div class="empty"><div class="big">👋</div>No messages yet — say hi.</div>';
    var out = '', prev = null;
    list.forEach(function (m) {
      var p = person(m.from), cont = prev && prev.from === m.from && m.ts - prev.ts < 5 * 60e3;
      out += '<div class="msg' + (cont ? ' cont' : '') + '">' + avatar(p, false) +
        '<div class="body">' + (cont ? '' : '<div class="meta"><span class="author" style="color:' + colorFor(p.name) + '">' + esc(p.name) + '</span><span class="time">' + time(m.ts) + '</span></div>') +
        '<div class="text">' + esc(m.text) + '</div></div></div>';
      prev = m;
    });
    return out;
  }

  function composer(placeholder) {
    return '<div class="composer"><form class="composer-box" id="send-form"><input id="msg-input" autocomplete="off" placeholder="' + esc(placeholder) + '" />' +
      '<button class="send" type="submit">➤</button></form></div>';
  }

  function renderRail() {
    var pending = state.incoming.length;
    var h = '<div class="rail"><button class="rail-btn' + (ui.view !== 'server' ? ' active' : '') + '" data-act="home" title="Home">K' +
      (pending ? '<span class="badge">' + pending + '</span>' : '') + '</button><div class="rail-sep"></div>';
    state.servers.forEach(function (s) {
      h += '<button class="rail-btn' + (ui.view === 'server' && ui.serverId === s.id ? ' active' : '') + '" data-act="server" data-id="' + s.id + '" title="' + esc(s.name) + '">' +
        esc(s.name.split(' ').map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase()) + '</button>';
    });
    h += '<button class="rail-btn" data-act="newserver" title="Create server" style="color:var(--green)">+</button></div>';
    return h;
  }

  function renderMe() {
    return '<div class="me-bar">' + avatar(state.me, true) + '<div class="name">' + esc(state.me.name) + '<small>Online</small></div>' +
      '<button class="icon-btn" data-act="logout" title="Log out">⏻</button></div>';
  }

  function renderSide() {
    var h = '<div class="side">';
    if (ui.view === 'server') {
      var s = currentServer();
      h += '<div class="side-head">' + esc(s.name) + '<button class="icon-btn" data-act="newchannel" title="New channel">+</button></div><div class="side-list"><div class="side-label">Text channels</div>';
      s.channels.forEach(function (c) {
        h += '<button class="item' + (c.id === ui.channelId ? ' active' : '') + '" data-act="channel" data-id="' + c.id + '"><span style="opacity:.6">#</span> ' + esc(c.name) + '</button>';
      });
      h += '</div>';
    } else {
      h += '<div class="side-head">Karp</div><div class="side-list">' +
        '<button class="item' + (ui.view === 'home' ? ' active' : '') + '" data-act="friends"><span>👥</span> Friends' +
        (state.incoming.length ? '<span class="pill" style="margin-left:auto;background:var(--red);color:#fff;border-radius:9px;font-size:11px;padding:1px 7px">' + state.incoming.length + '</span>' : '') + '</button>' +
        '<div class="side-label">Direct messages</div>';
      state.friends.forEach(function (id) {
        var p = person(id);
        h += '<button class="item' + (ui.view === 'dm' && ui.dmId === id ? ' active' : '') + '" data-act="dm" data-id="' + id + '">' + avatar(p, true) + esc(p.name) + '</button>';
      });
      if (!state.friends.length) h += '<div style="color:var(--muted);padding:8px 10px;font-size:13px">Add friends to start chatting.</div>';
      h += '</div>';
    }
    return h + renderMe() + '</div>';
  }

  function topBar(title, prefix) {
    return '<div class="top"><button class="menu" data-act="menu">☰</button>' + (prefix ? '<span class="hash">' + prefix + '</span>' : '') + esc(title) + '</div>';
  }

  function renderFriends() {
    var tabs = [['online', 'Online'], ['all', 'All'], ['pending', 'Pending']];
    var h = topBar('Friends', '👥') + '<div class="tabs">';
    tabs.forEach(function (t) {
      h += '<button class="tab' + (ui.tab === t[0] ? ' active' : '') + '" data-act="tab" data-id="' + t[0] + '">' + t[1] +
        (t[0] === 'pending' && state.incoming.length ? '<span class="pill">' + state.incoming.length + '</span>' : '') + '</button>';
    });
    h += '<button class="tab add' + (ui.tab === 'add' ? ' active' : '') + '" data-act="tab" data-id="add">Add Friend</button></div><div class="panel">';

    if (ui.tab === 'add') {
      h += '<div class="add-box"><h3>Add a friend</h3><p>Enter their Karp username to send a request.</p>' +
        '<form class="add-row" id="add-form"><input class="field" id="add-input" placeholder="username" autocapitalize="none" autocomplete="off" />' +
        '<button class="btn small" type="submit">Send</button></form>' +
        (ui.addMsg ? '<div class="note ' + (ui.addMsg.ok ? 'ok' : 'err') + '">' + esc(ui.addMsg.msg) + '</div>' : '') + '</div>';
    } else if (ui.tab === 'pending') {
      if (!state.incoming.length && !state.outgoing.length) h += '<div class="empty"><div class="big">📬</div>No pending requests.</div>';
      if (state.incoming.length) h += '<div class="side-label" style="padding-left:0">Incoming — ' + state.incoming.length + '</div>';
      state.incoming.forEach(function (id) {
        var p = person(id);
        h += '<div class="friend-row">' + avatar(p, false) + '<div class="info"><b>' + esc(p.name) + '</b><small>Incoming request</small></div>' +
          '<div class="actions"><button class="icon-btn ok" data-act="accept" data-id="' + id + '">✓</button><button class="icon-btn no" data-act="decline" data-id="' + id + '">✕</button></div></div>';
      });
      if (state.outgoing.length) h += '<div class="side-label" style="padding-left:0">Sent — ' + state.outgoing.length + '</div>';
      state.outgoing.forEach(function (id) {
        var p = person(id);
        h += '<div class="friend-row">' + avatar(p, false) + '<div class="info"><b>' + esc(p.name) + '</b><small>Outgoing request</small></div>' +
          '<div class="actions"><button class="icon-btn no" data-act="cancel" data-id="' + id + '">✕</button></div></div>';
      });
    } else {
      var list = state.friends.filter(function (id) { return ui.tab === 'all' || person(id).status !== 'offline'; });
      if (!list.length) h += '<div class="empty"><div class="big">🐟</div>' + (ui.tab === 'online' ? 'Nobody is online right now.' : 'No friends yet — add some!') + '</div>';
      list.forEach(function (id) {
        var p = person(id);
        h += '<div class="friend-row">' + avatar(p, true) + '<div class="info"><b>' + esc(p.name) + '</b><small>' + p.status + '</small></div>' +
          '<div class="actions"><button class="icon-btn" data-act="dm" data-id="' + id + '" title="Message">💬</button>' +
          '<button class="icon-btn no" data-act="unfriend" data-id="' + id + '" title="Remove friend">✕</button></div></div>';
      });
    }
    return h + '</div>';
  }

  function renderMain() {
    if (ui.view === 'server') {
      var c = currentChannel();
      return topBar(c.name, '#') + '<div class="msgs" id="msgs">' + renderMsgs(c.msgs) + '</div>' + composer('Message #' + c.name);
    }
    if (ui.view === 'dm') {
      var p = person(ui.dmId);
      return topBar(p.name, '@') + '<div class="msgs" id="msgs">' + renderMsgs(state.dms[ui.dmId] || []) + '</div>' + composer('Message @' + p.name);
    }
    return renderFriends();
  }

  function renderMembers() {
    if (ui.view !== 'server') return '';
    var ids = ['me'].concat(DIRECTORY.slice(0, 5).map(function (u) { return u.id; }));
    var h = '<div class="members"><div class="side-label">Members — ' + ids.length + '</div>';
    ids.forEach(function (id) {
      var p = person(id), friend = id !== 'me' && Friends.isFriend(id);
      h += '<div class="item">' + avatar(p, true) + '<span style="flex:1">' + esc(p.name) + '</span>' +
        (id !== 'me' && !friend && state.outgoing.indexOf(id) < 0 ? '<button class="icon-btn" style="width:30px;height:30px;font-size:13px" data-act="quickadd" data-id="' + id + '" title="Add friend">+</button>' : '') + '</div>';
    });
    return h + '</div>';
  }

  function renderLogin() {
    return '<div class="login"><div class="logo">K</div><h1>Karp</h1><p>Chat, hang out, stay close.</p>' +
      '<form id="login-form"><input class="field" id="login-name" maxlength="20" placeholder="Pick a username" autocapitalize="none" autocomplete="off" />' +
      '<button class="btn" type="submit">Continue</button></form></div>';
  }

  function render(keepFocus) {
    var app = document.getElementById('app');
    var prevInput = document.getElementById('msg-input'), draft = prevInput ? prevInput.value : '';
    if (!state) { app.innerHTML = renderLogin(); return; }
    app.innerHTML = '<div class="shell' + (ui.menu ? ' open' : '') + '">' + renderRail() + renderSide() + '<div class="scrim" data-act="scrim"></div><div class="main">' + renderMain() + '</div>' + renderMembers() + '</div>';
    var m = document.getElementById('msgs'); if (m) m.scrollTop = m.scrollHeight;
    var inp = document.getElementById('msg-input'); if (inp) { inp.value = draft; if (keepFocus) inp.focus(); }
  }

  /* ---------- events ---------- */
  document.addEventListener('submit', function (e) {
    e.preventDefault();
    var id = e.target.id;
    if (id === 'login-form') {
      var n = document.getElementById('login-name').value.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '');
      if (!n) return;
      state = seed(n); Store.save(); render();
    } else if (id === 'send-form') {
      var inp = document.getElementById('msg-input'), t = inp.value.trim(); if (!t) return;
      var msg = { id: uid(), from: 'me', text: t, ts: Date.now() };
      if (ui.view === 'server') currentChannel().msgs.push(msg);
      else { (state.dms[ui.dmId] = state.dms[ui.dmId] || []).push(msg); botReply(ui.dmId); }
      inp.value = ''; Store.save(); render(true);
    } else if (id === 'add-form') {
      ui.addMsg = Friends.sendRequest(document.getElementById('add-input').value); render();
    }
  });

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]'); if (!el) return;
    var act = el.getAttribute('data-act'), id = el.getAttribute('data-id');
    ui.menu = false;
    switch (act) {
      case 'home': case 'friends': ui.view = 'home'; break;
      case 'tab': ui.tab = id; ui.addMsg = null; ui.view = 'home'; break;
      case 'server': ui.view = 'server'; ui.serverId = id; ui.channelId = currentServer().channels[0].id; break;
      case 'channel': ui.channelId = id; break;
      case 'dm': ui.view = 'dm'; ui.dmId = id; break;
      case 'menu': ui.menu = true; break;
      case 'scrim': break;
      case 'accept': Friends.accept(id); break;
      case 'decline': Friends.decline(id); break;
      case 'cancel': Friends.cancel(id); break;
      case 'unfriend': if (confirm('Remove ' + person(id).name + ' from your friends?')) Friends.remove(id); break;
      case 'quickadd': Friends.sendRequest(person(id).name); break;
      case 'newserver':
        var sn = prompt('Server name?'); if (sn && sn.trim()) {
          var s = { id: uid(), name: sn.trim(), channels: [{ id: uid(), name: 'general', msgs: [] }] };
          state.servers.push(s); ui.view = 'server'; ui.serverId = s.id; ui.channelId = s.channels[0].id; Store.save();
        } break;
      case 'newchannel':
        var cn = prompt('Channel name?'); if (cn && cn.trim()) {
          var ch = { id: uid(), name: cn.trim().toLowerCase().replace(/\s+/g, '-'), msgs: [] };
          currentServer().channels.push(ch); ui.channelId = ch.id; Store.save();
        } break;
      case 'logout': if (confirm('Log out? Local data on this device will be cleared.')) { localStorage.removeItem(KEY); state = null; ui = { view: 'home', tab: 'online' }; } break;
    }
    render();
  });

  state = Store.load();
  render();
})();
