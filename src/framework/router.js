
var Router = function(app, actions) {
  this.app = app;
  if(actions || (! this.actions)) {
    this.actions = actions || {};
  }
};

Router.prototype = {
  generate: function(actionName, params) {
    var action = this.actions[actionName];
    if(action.generate) {
      return action.generate(params);
    } else {
      throw new Router.NotGeneratable("Action cannot be generated: " + actionName);
    }
  },

  match: function(path) {
    var md, action;
    for(var name in this.actions) {
      action = this.actions[name];
      if((md = path.match(action.match))) {
        console.log('state matched', JSON.stringify(path), action, md);
        return function(state) {
          state.action = name;
          return action.run.apply(this.app, [state].concat(md.slice(1)));
        }.bind(this);
      }
    }
    throw new Router.NotMatched("No route matched: " + path);
  }
};

Router.NotMatched = function(message) {
  var err = Error.call(this, message);
  err.name = 'Router.NotMatched'
  return err;
};

Router.NotMatched.prototype = Object.create(Error.prototype, {
  constructor: { value: Router.NotMatched }
});


Router.NotGeneratable = function(message) {
  var err = Error.call(this, message);
  err.name = 'Router.NotGeneratable'
  return err;
};

Router.NotGeneratable.prototype = Object.create(Error.prototype, {
  constructor: { value: Router.NotGeneratable }
});
