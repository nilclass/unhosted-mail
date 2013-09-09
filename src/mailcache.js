var Mailcache = function() {

  eventHandling(this, 'fetch-info');

  this._watchers = {};

  /** SETUP REMOTESTORAGE **/

  //remoteStorage.enableLog();
  remoteStorage.access.claim('email', 'rw');
  remoteStorage.caching.enable('/email/');
  remoteStorage.access.claim('contacts', 'r');
  remoteStorage.caching.enable('/contacts/');
  remoteStorage.displayWidget();

  /** SETUP SOCKETHUB **/

  // connect sockethub
  this.sockethub = SockethubClient.connect({
    // FIXME: make all this configurable.
    host: 'localhost',
    register: {
      secret: '1234567890'
    }
  });

  this.sockethub.declareVerb('fetch', ['actor.address', 'object'], {
    platform: 'email',
    actor: {},
    object: {}
  });

  this.sockethub.on('connected', this._forwardCredentials.bind(this));

  this.sockethub.on('message', function(message) {
    if(this._currentFetch) {
      this._currentFetch.counter--;
      this._currentFetch.cache.push(this._convertMessage(message));
      if(this._currentFetch.counter == 0) {
        this._currentFetch.saving = true;
        this._emit('fetch-info', {
          message: "Saving fetched messages..."
        });
        // FIXME: use the right mailbox!
        remoteStorage.email.mailbox('inbox').storeAll(this._currentFetch.cache).
          then(function() {
            this._emit('fetch-info', {
              message: "Done fetching " + this._currentFetch.count + " messages.",
              done: true
            });
            delete this._currentFetch;
          }.bind(this));
      } else {
        this._currentFetch.current = this._currentFetch.count - this._currentFetch.counter;
        this._emit('fetch-info', {
          message: "Fetched " + (this._currentFetch.count - this._currentFetch.counter) + "/" + this._currentFetch.count + " messages..."
        });
      }
    } else {
      console.error("received unexpected message", message);
    }
  }.bind(this));

};

Mailcache.prototype = {

  saveAccount: function(account) {
    return remoteStorage.email.credentials.saveAccount(account);
  },

  getCurrentAccount: function() {
    if(this._currentAccount) {
      return promising().fulfill(this._currentAccount);
    }
    return remoteStorage.email.credentials.getCurrent().
      then(function(account) {
        this._currentAccount = account;
        return account;
      }.bind(this));
  },

  updateAccount: function(section, key, value) {
    return this.getCurrentAccount().then(function(account) {
      if(! account) account = {};
      if(! account[section]) account[section] = {};
      account[section][key] = value;
      return this.saveAccount(account);
    }.bind(this)).then(function(errors, account) {
      if(errors) {
        throw errors;
      }
      if(account.actor) {
        return remoteStorage.email.credentials.setCurrent(account.actor);
      }
    });
  },

  listAccounts: function() {
    return remoteStorage.email.credentials.listAccounts();
  },

  switchAccount: function(address) {
    return remoteStorage.email.credentials.getAccount(address).
      then(function(account) {
        if(account && account.actor) {
          remoteStorage.email.credentials.setCurrent(account.actor);
        }
      });
  },

  // retrieve messages for given mailbox from remotestorage.
  list: function(mailboxName, options) {
    return remoteStorage.email.mailbox(mailboxName).list(options);
  },
  
  fetch: function() {
    if(this._currentFetch) return;
    this._emit('fetch-info', { message: "Starting to fetch messages..." });
    return this.getCurrentAccount().then(function(account) {
      return this.sockethub.fetch(account.actor.address, {
        includeBody: true
      });
    }.bind(this)).then(function(result) {
      this._currentFetch = result.object;
      this._currentFetch.counter = result.object.count;
      this._currentFetch.cache = [];
    }.bind(this));
  },

  _forwardCredentials: function() {
    var sockethub = this.sockethub;
    this.listAccounts().then(function(addresses) {
      var n = addresses.length, i = 0;
      var credentials = {};
      addresses.forEach(function(address) {
        remoteStorage.email.credentials.getAccount(address).then(function(account) {
          credentials[address] = account;
          i++;
          if(i == n) {
            sockethub.set('email', { credentials: credentials }).then(function() {
              console.log('SET DONE');
            }, function(error) {
              console.error('FAILED TO FORWARD CREDENTIALS', error);
            });
          }
        });
      });
    });
  },

  watch: function(mailbox, handler) {
    this._watchers[mailbox] = handler;
    remoteStorage.email.mailbox(mailbox).addEventListener('change', handler);
  },

  unwatch: function(mailbox) {
    remoteStorage.email.mailbox(mailbox).removeEventListener('change', this._watchers[mailbox]);
    delete this._watchers[mailbox];
  },

  _convertMessage: function(sockethubMessage) {
    var message = {};
    message.from = sockethubMessage.actor;
    message.to = [];
    message.cc = [];
    message.bcc = [];
    sockethubMessage.target.forEach(function(target) {
      message[target.field] = {
        name: target.name,
        address: target.address
      };
    });
    for(var key in sockethubMessage.object) {
      message[key] = sockethubMessage.object[key];
    }
    message.body = message.text;
    delete message.text;
    return message;
  }

};
