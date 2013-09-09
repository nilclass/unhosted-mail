
var App = function(window) {
  this.window = window;
  this.document = window.document;
  this.containers = {};
  this.LAYOUT_CONTAINERS.forEach(this._loadContainerReference.bind(this));

  this.templates = new Templates(this.containers.content);
  this.router = new this.Router(this);

  [ '_pushState', '_popState', '_setState', '_rendered',
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
    if(this._unload) {
      this._unload();
    }
    if(this.beforeDispatch) {
      var result = this.beforeDispatch(path, state);
      if(typeof(result) == 'object' && typeof(result.then) == 'function') {
        return result.then(function(res) {
          if(res === false) {
            return; // abort dispatch
          } else {
            this._dispatch(path, state);
          }
        }.bind(this), this._dispatchFailed);
      } else if(result === false) {
        return; // abort dispatch
      }
    }
    this._dispatch(path, state);
  },

  _dispatch: function(path, state) {
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


  _dispatchFailed: function(error) {
    this.logError("dispatch failed", error);
  },

  // after state has been loaded.
  _setState: function(state) {
    //console.log('pushState', state);
    this.window.history.replaceState(state, undefined, document.location);
    return state;
  },

  // from 'popstate' event
  _popState: function(event) {
    //console.log('popState', event);
    this.dispatch(this._extractPath(this.document.location), event.state);
  },

  // from nav 'click' event
  _pushState: function(event) {
    var path = typeof(event) === 'string' ? event : event.target.getAttribute('href');
    if(typeof(event) === 'object') {
      event.preventDefault();
    }
    this.window.history.pushState(null, undefined, '?!' + path);
    this.dispatch(path);
  },

  _watchUrlChange: function() {
    this.window.addEventListener('popstate', this._popState);
  },

  redirect: function(action, params) {
    console.log('redirect', action, params);
    setTimeout(this._pushState, 500, this.router.generate(action, params));
  },

  // 
  watchLinks: function(links, callback) {
    if(! callback) callback = this._pushState;
    Array.prototype.slice.call(links).forEach(function(item) {
      item.addEventListener('click', callback);
    });
  },

  watchForm: function(form, callback) {
    form.addEventListener('submit', function(event) {
      event.preventDefault();
      callback(form);
    });
    $$(form, 'input, textarea').forEach(function(element) {
      element.dataset.lastValue = element.value;
      element.addEventListener('blur', function(event) {
        if(element.dataset.lastValue != element.value) {
          element.dataset.lastValue = element.value;
          callback(form, event.target);
        }
      });
    });
  },

  watchCommand: function(name, handler) {
    $$(this.containers.content, '*[data-command="' + name + '"]').
      forEach(function(element) {
        element.addEventListener('click', handler);
      });
  },

  _watchNavItems: function() {
    this.watchLinks(this.containers.header.querySelectorAll('.nav-item'));
  },

  _loadContainerReference: function(domId) {
    var container = this.document.getElementById(domId);
    if(! container) {
      throw new Error("Container not found: " + domId);
    }
    this.containers[domId.replace(/\-[a-z]/g, function(c) {
      return c[1].toUpperCase()
    })] = container;
  },

  _extractPath: function(location) {
    if(location.search && location.search.match(/^\?\!/)) {
      return location.search.slice(2);
    } else {
      return '';
    }
  },

  _computeState: function(path) {
    //this.log('compute state', path);
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
    return this.renderFlash().then(function() {
      // render template
      return this.templates.render(state.template || state.action, state.view);
    }.bind(this)).then(function() {
      // call action's afterRender
      var afterRender = this.router.actions[state.action].afterRender;
      if(afterRender) {
        return afterRender.apply(this, [this.containers.content, state]);
      }
    }.bind(this)).then(function() {
      // call app's afterRender
      if(this.afterRender) {
        return this.afterRender.apply(this, [this.containers.content, state]);
      }
    }.bind(this)).then(function() {
      // save 'unload' function
      var unload = this.router.actions[state.action].unload;
      if(unload) {
        this._unload = unload.bind(this, state);
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

  /** LOGGING **/

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
  },

  /** FLASH **/

  flash: function(type, message) {
    var flash = this._flash;
    flash[type] = message;
    this._flash = flash;
  },

  clearFlash: function() {
    this._flash = {};
  },

  renderFlash: function() {
    var flash = this._flash;
    if(Object.keys(flash).length > 0) {
      return this.templates.renderToString('flash', flash).then(function(html) {
        this.clearFlash();
        this.containers.flash.innerHTML = html;
      }.bind(this));
    } else {
      return promising().fulfill();
    }
  }


};


Object.defineProperty(App.prototype, '_flash', {
  get: function() {
    if(! this.__flash) {
      try {
        this.__flash = JSON.parse(localStorage['mail-app:flash']);
      } catch(exc) {
        this.__flash = {};
      }
    }
    return this.__flash;
  },
  set: function(value) {
    this.__flash = value;
    localStorage['mail-app:flash'] = JSON.stringify(this.__flash);
  }
});

