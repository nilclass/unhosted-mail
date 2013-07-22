
var App = function(window) {
  this.window = window;
  this.document = window.document;
  this.containers = {};
  MailApp.LAYOUT_CONTAINERS.forEach(this._loadContainerReference.bind(this));

  this.templates = new Templates(this.containers.content);
  this.router = new this.Router(this);

  [ '_pushState', '_popState', '_setState',
    '_renderState', '_dispatchFailed'
  ].forEach(function(methodName) {
    this[methodName] = this[methodName].bind(this);
  }.bind(this));

  eventHandling(this, 'rendered');

  this._watchUrlChange();
  this._watchNavItems();
};

App.prototype = {

  Router: Router,

  dispatch: function(path, state) {
    this.log("dispatch " + path, state);
    try {
      if(state) {
        return this._renderState(state).
          then(undefined, this._dispatchFailed);
      } else {
        return this._computeState(path).
          then(this._setState).
          then(this._renderState).
          then(this._rendered, this._dispatchFailed);
      }
    } catch(exc) {
      this._dispatchFailed(exc);
    }
  },

  redirect: function(action, params) {
    setTimeout(this._pushState, 0, this.router.generate(action, params));
  },

  // after state has been loaded.
  _setState: function(state) {
    console.log('pushState', state);
    this.window.history.replaceState(state);
    return state;
  },

  // from 'popstate' event
  _popState: function(event) {
    console.log('popState', event);
    this.dispatch(this._extractPath(this.document.location), event.state);
  },

  // from nav 'click' event
  _pushState: function(event) {
    var path = typeof(event) === 'string' ? event : event.target.getAttribute('href');
    if(typeof(event) === 'object') {
      event.preventDefault();
    }
    this.window.history.pushState(null, undefined, '?!?' + path);
    this.dispatch(path);
  },

  _watchUrlChange: function() {
    this.window.addEventListener('popstate', this._popState);
  },

  _watchNavItems: function() {
    Array.prototype.slice.call(
      this.containers.header.querySelectorAll('.nav-item')
    ).forEach(function(item) {
      item.addEventListener('click', this._pushState);
    }.bind(this));
  },

  _loadContainerReference: function(domId) {
    var container = this.document.getElementById(domId);
    if(! container) {
      throw new Error("Container not found: " + domId);
    }
    this.containers[domId] = container;
  },

  _extractPath: function(location) {
    if(location.search && location.search.match(/^\?\!\?/)) {
      return location.search.slice(3);
    } else {
      return '';
    }
  },

  _computeState: function(path) {
    this.log('compute state', path);
    var state = {};
    var result = this.router.match(path)(state);
    if(typeof(result) == 'object' && typeof(result.then) == 'function') {
      return result.then(function(res) {
        return res || state;
      });
    } else {
      return promising().fulfill((result || (result === false)) ? result : state);
    }
  },

  _renderState: function(state) {
    if(! state) return;
    this.log("Render state: ", state);
    if(state.highlight) {
      this._highlightNav(state.highlight);
    }
    return this.templates.render(state.template, state.view).
      then(function() {
        var afterRender = this.router.actions[state.action].afterRender;
        if(afterRender) {
          return afterRender.apply(this, [this.containers.content]);
        }
      }.bind(this));
  },

  _rendered: function() {
    this._emit("rendered");
  },

  _highlightNav: function(name) {
    var current = this.containers.header.querySelector('.nav-item.current');
    if(current) current.classList.remove('current');
    this.containers.header.querySelector('.nav-item[data-item-name="' + name + '"]').
      classList.add('current');
  },

  _dispatchFailed: function(error) {
    this.logError("dispatch failed", error);
  },

  log: function() {
    console.log.apply(console, arguments);
  },

  logError: function(message, exc) {
    if(typeof(exc) == 'object' && exc instanceof Error) {
      message = message + ': ' + exc.message + '\n' + exc.stack;
    } else {
      message = message + ': ' + exc;
    }
    console.error(message);
  }

};
