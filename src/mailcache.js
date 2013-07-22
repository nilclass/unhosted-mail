var Mailcache = function() {
  
};

Mailcache.prototype = {

  list: function(mailboxName, options) {
    return remoteStorage.email.mailbox(mailboxName).list(options);
  },

  sync: function() {
  }

};