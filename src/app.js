
var MailApp = function() {
  this.mailcache = new Mailcache();
  this.mailcache.sockethub.on('connected', this.renderSockethubState.bind(this));
  this.mailcache.sockethub.on('registered', this.renderSockethubState.bind(this));
  this.mailcache.sockethub.on('failed', function() {
    this.renderSockethubState({ failed: true });
  }.bind(this));

  this.mailcache.on('fetch-info', function(info) {
    var container = this.containers.fetchInfo;
    this.templates.renderToString('fetch-info', info).then(function(html) {
      container.innerHTML = html;
      if(info.done) {
        setTimeout(function() {
          container.innerHTML = '';
        }, 1750);
      }
    });
  }.bind(this));

  remoteStorage.on('disconnect', function() {
    document.location.search = '';
  });
  App.apply(this, arguments);
};

MailApp.prototype = Object.create(App.prototype);
MailApp.prototype.LAYOUT_CONTAINERS = ['header', 'flash', 'content', 'sockethub', 'fetch-info'];
MailApp.prototype.Router = MailRouter;

Object.defineProperty(MailApp.prototype, 'savedPath', {
  get: function() {
    return localStorage['mail-app:saved-path'];
  },
  set: function(path) {
    localStorage['mail-app:saved-path'] = path;
  }
});

MailApp.prototype.renderSockethubState = function(state) {
  if(! state) {
    state = this._sockethubState || this.mailcache.sockethub;
  }
  this._sockethubState = state;
  this.templates.renderToString('sockethub-state', state).
    then(function(html) {
      this.containers.sockethub.innerHTML = html;
    }.bind(this));
}

MailApp.prototype.afterRender = function() {
  this.renderSockethubState();
};

MailApp.prototype.beforeDispatch = function(path) {
  if(path.match(/^not-connected$/)) return;
  if(! remoteStorage.connected) {
    this.savedPath = path;
    this.redirect('not-connected');
    return false;
  }
  if(path.match(/^accounts/)) return;
  return this.mailcache.listAccounts().then(function(accounts) {
    if(accounts.length == 0) {
      this.flash('info', "Please configure at least one account.");
      this.redirect('accounts');
      return false;
    }
  }.bind(this));
};

window.addEventListener('load', function() {
  window.app = new MailApp(window);
});

function watchPromise(p) {
  return p.then(function() {
    console.log('promise fulfilled', arguments);
  }, function() {
    console.log('promise rejected', arguments);
  });
}

var WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday"
];

function usefulDate(date) {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hour: date.getHours(),
    minute: date.getMinutes(),
    second: date.getSeconds(),
    wday: WEEKDAYS[date.getDay()]
  };
}

function twoDigit(n) {
  var s = n.toString();
  return s.length == 1 ? '0'+s : s;
}

function prettyDate(date) {
  var nowDate = new Date();
  var given = usefulDate(date);
  var now = usefulDate(nowDate);
  var diff = usefulDate(new Date(nowDate.getTime() - date.getTime()));

  if(diff.day == 0) {
    if(diff.hour > 1) {
      return given.hour + ":" + given.minute;
    } else if(diff.minute < 2) {
      return "just now";
    } else {
      return diff.minute + " minutes ago"
    }
  } else if(diff.day == 2) {
    return "Yesterday, " + twoDigit(given.hour) + ":" + twoDigit(given.minute);
  } else if(diff.day < 7) {
    return given.wday + ", " + twoDigit(given.hour) + ":" + twoDigit(given.minute);
  } else {
    return [given.year, twoDigit(given.month), twoDigit(given.day)].join('-');
  }
}
