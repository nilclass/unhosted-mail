var MailRouter = function() {
  Router.apply(this, arguments);
};

MailRouter.prototype = Object.create(Router.prototype);

MailRouter.prototype.actions = {

  // * within action's "run" and "afterRender" methods "this" refers to the app.
  // * the state parameter for "run" is both input and output.
  // * "run" can return a Promise, false or undefined. If it's...
  //   - ... a Promise: once the promise is fulfilled rendering happens.
  //   - ... false: no rendering happens. You should use this.redirect() before, otherwise the app gets stuck.
  //   - ... undefined: rendering happens immediately.

  inbox: {
    match: /^$/,
    run: function(state) {
      this.redirect('mailbox', { name: 'inbox' });
      return false;
    }
  },

  mailbox: {
    match: /^mailbox\/([^\/]+)\/?$/,
    generate: function(params) {
      return 'mailbox/' + params.name;
    },
    run: function(state, mailboxName) {
      state.highlight = 'inbox';
      state.template = 'mailbox-list';
      return this.mailcache.list(mailboxName).then(function(result) {
        state.view = result;
      });
      // view: {
      //   name: mailboxName,
      //   count: 2,
      //   total: 2,
      //   messages: [
      //     { from: 'nil@heahdk.net', subject: "Hey, how's it going?", date: new Date(), id: '1' },
      //     { from: 'foo@bar.baz', subject: 'oh, hey!', date: new Date(), id: '2' }
      //   ]
      // }
    }
  },

  read: {
    match: /^read\/([^\/]+)\/?$/,
    run: function(state, messageId) {
      state.template = 'read-message';
      state.view = {
        from: 'nil@heahdk.net',
        subject: "Hey, how's it going?",
        body: "also, Hey how's it going?",
        date: new Date()
      };
    }
  },

  compose: {
    match: /^compose$/,
    run: function(state) {
      state.highlight = 'compose';
      state.template = 'compose';
    },
    afterRender: function(content) {
      content.querySelector('input[name="to"]').focus();
    }
  },

  settings: {
    match: /^settings(?:\/(.+)|)$/,
    generate: function(params) {
      return 'settings/' + params.section;
    },
    run: function(state, section) {
      if(section) {
        state.highlight = 'settings',
        state.template = 'settings-' + section;
        var promise = promising();
      } else {
        this.redirect('settings', { section: 'general' });
      }
    },
    afterRender: function(content) {
      content.querySelector('input').focus();
    }
  }

};

