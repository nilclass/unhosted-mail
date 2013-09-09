var MailRouter = function() {
  Router.apply(this, arguments);
};

MailRouter.prototype = Object.create(Router.prototype);

function selfOrParent(e, className) {
  if(e == document) return;
  if(e.classList.contains(className)) return e;
  return selfOrParent(e.parent);
}

MailRouter.prototype.actions = {

  // * within action's "run" and "afterRender" methods "this" refers to the app.
  // * the state parameter for "run" is both input and output.
  // * "run" can return a Promise, false or undefined. If it's...
  //   - ... a Promise: once the promise is fulfilled rendering happens.
  //   - ... false: no rendering happens. You should use this.redirect() before, otherwise the app gets stuck.
  //   - ... undefined: rendering happens immediately.

  // ACTION: inbox
  inbox: {
    match: /^$/,
    generate: function() { return ''; },
    run: function(state) {
      this.redirect('mailbox', { name: 'inbox' });
      return false;
    }
  },

  // ACTION: mailbox
  mailbox: {
    match: /^mailbox\/([^\/]+)\/?$/,
    generate: function(params) {
      return 'mailbox/' + params.name;
    },
    run: function(state, mailboxName) {
      state.highlight = 'inbox';
      state.template = 'mailbox-list';
      state.mailboxName = mailboxName;
      return this.mailcache.list(mailboxName).then(function(messages) {
        state.view = {
          name: mailboxName,
          messages: messages.map(function(message) {
            var date = new Date(Date.parse(message.date));
            message.date = prettyDate(date);
            message.fullDate = date.toString();
            return message;
          })
        };
      });
    },
    afterRender: function(content, state) {
      this.watchCommand('fetch', function() {
        if(this.mailcache.sockethub.registered) {
          this.mailcache.fetch(state.mailboxName);
        }
      }.bind(this));
      content.querySelector('.messages').addEventListener('click', function(event) {
        var messageDiv = selfOrParent(event, '.message');
        if(messageDiv) {
          this.redirect('read', { path: messageDiv.dataset.path });
        }
      }.bind(this));
      this.mailcache.watch(state.mailboxName, function(event) {
        console.log('mailbox change', event);
      });
    },
    unload: function(state) {
      this.mailcache.unwatch(state.mailboxName);
    }
  },

  // ACTION: read
  read: {
    match: /^read\/(.+)$/,
    generate: function(params) {
      return 'read/' + params.path;
    },
    run: function(state, path) {
      state.template = 'read-message';
      state.view = {
        from: 'nil@heahdk.net',
        subject: "Hey, how's it going?",
        body: "also, Hey how's it going?",
        date: new Date()
      };
    }
  },

  // ACTION: compose
  compose: {
    match: /^compose$/,
    run: function(state) {
      state.highlight = 'compose';
      state.flags = {
        encrypt: false,
        sign: false
      };
      state.view = { flags: state.flags };
    },
    afterRender: function(content, state) {
      content.querySelector('input[name="to"]').focus();

      this.watchCommand('send', function() {
        console.log('SEND MESSAGE');
      });

      this.watchCommand('toggle', function(event) {
        var value = (event.target.dataset.state != 'true');
        event.target.dataset.state = value;
        state.flags[event.target.dataset.toggleFlag] = value;
        event.target.classList[value ? 'add' : 'remove']('toggle-on');
        console.log('FLAGS', state.flags);
      });
    }
  },

  // ACTION: settings
  settings: {
    match: /^settings(?:\/(.+)|)$/,
    generate: function(params) {
      return 'settings/' + params.section;
    },
    run: function(state, section) {
      if(section) {
        state.highlight = 'settings',
        state.template = 'settings/' + section;
        state.section = section;
        state.view = {};
        return this.mailcache.getCurrentAccount().then(function(account) {
          state.view[section] = account[section];
        });
      } else {
        this.redirect('settings', { section: 'actor' });
        return false;
      }
    },
    afterRender: function(content, state) {
      content.querySelector('input').focus();
      this.watchLinks(content.querySelectorAll('a'));
      this.watchForm(content.querySelector('form'), function(form, input) {
        var value = input.type == 'checkbox' ?
          input.checked :
          input.type == 'number' ?
          parseInt(input.value) :
          input.value;
        this.mailcache.updateAccount(state.section, input.name, value).
          then(function() {
            console.log('SAVE SUCCESS');
          }, function(error) {
            console.log('SAVE ERRORS', error);
          }.bind(this));
      }.bind(this));
    }
  },

  // ACTION: accounts
  accounts: {
    match: /^accounts$/,
    run: function(state) {
      return this.mailcache.listAccounts().then(function(accounts) {
        console.log('accounts', accounts);
        state.view = {
          accounts: accounts
        };
        state.highlight = 'accounts';
      });
    },
    afterRender: function(content, state) {
      this.watchLinks(content.querySelectorAll('a'));
    }
  },

  // ACTION: newAccount
  newAccount: {
    match: /^accounts\/new$/,
    run: function(state) {
      state.template = 'settings/actor';
      state.view = { isNew: true };
    },
    afterRender: function(content, state) {
      this.watchForm(content.querySelector('form'), function(form) {
        this.mailcache.saveAccount({
          actor: {
            name: form.name.value,
            address: form.address.value
          }
        }).then(function(errors, account) {
          if(errors) {
            this.highlightErrors(form, errors);
          } else {
            this.mailcache.switchAccount(account.actor.address);
          }
        }.bind(this));
        
      }.bind(this));
    }
  },

  switchAccount: {
    match: /^accounts\/switch\/(.+)$/,
    run: function(state, account) {
      state.template = 'accounts/switch';
      state.highlight = 'accounts';
      state.view = { account: account };
    },
    afterRender: function(content, state) {
      return this.mailcache.switchAccount(state.view.account).then(function() {
        this.redirect('inbox');
      }.bind(this), function(error) {
        content.innerHTML = "<em>Switching failed!</em>";
        console.log('error', error, error.stack);
      }.bind(this));
    }
  },

  // ACTION: notConnected
  notConnected: {
    match: /^not-connected$/,
    generate: function() { return 'not-connected'; },
    run: function(state) {
      state.template = 'not-connected';
      remoteStorage.on('ready', function() {
        if(this.savedPath && !this.savedPath.match(/not(?:C|-c)onnected/)) {
          this.redirect(this.savedPath);
        } else {
          this.redirect('');
        }
      }.bind(this));
    }
  }

};

