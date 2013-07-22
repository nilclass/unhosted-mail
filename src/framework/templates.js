var Templates = function(container) {
  if(typeof(container) !== 'object' || !(container instanceof Element)) {
    throw new Error("Container is required and must be an Element.");
  }
  this._container = container;
  this._cache = {};
  this._lookup = this._lookup.bind(this);
};

Templates.prototype = {

  render: function(name, locals) {
    return this._lookup(name).then(function(template) {
      return this._render(template, locals);
    }.bind(this));
  },

  preload: function() {
    var promise = promising();
    var templateNames = Array.prototype.slice.call(arguments);
    var n = templateNames.length, i = 0;
    function done() {
      i++;
      if(i == n) {
        promise.fulfill();
      }
    }
    templateNames.forEach(function(name) {
      this._lookup(name).then(done, promise.reject);
    }.bind(this));
    return promise;
  },

  _lookup: function(name) {
    if(name in this._cache) {
      return promising().fulfill(this._cache[name]);
    } else {
      return this._load(name).then(function(template) {
        this._cache[name] = template;
        return template;
      }.bind(this));
    }
  },

  _render: function(template, locals) {
    this._container.innerHTML = Mustache.render(template, locals, this._cache);
  },

  _load: function(name) {
    var promise = promising();
    var request = new XMLHttpRequest();
    request.open('GET', 'templates/' + name + '.html');
    request.onload = function() {
      try {
        if(request.status == 404) {
          promise.fulfill("<span style=\"color:red\">Template not found: " + name + "</span>");
        } else {
          promise.fulfill(request.responseText);
        }
      } catch(e) {
        promise.reject(e);
      }
    };
    request.onerror = request.onabort = function(error) {
      promise.reject(error);
    }
    request.send();
    return promise;
  }

};
