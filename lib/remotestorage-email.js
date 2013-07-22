RemoteStorage.defineModule('email', function(privateClient, publicClient) {

  /**
   * Using the mailbox index:
   *
   *
   *
   *   email.mailbox('inbox').store({
   *     date: ...
   *     subject: ...
   *     body: ...
   *     to: [
   *       {
   *         name: ...
   *         address: ...
   *       }
   *     ]
   *   });
   *   // will store at:
   *   //   /email/mailbox/inbox/pool/<year>/<month>/<day>/
   *   //     <hour>-<minute>-<second>-<message-id>
   *   
   *   email.mailbox('inbox').list({
   *     limit: 50,
   *     order: 'desc'
   *   });
   *   // returns the 50 latest messages (this is also the defaults)
   *
   *   email.mailbox('sent').list({
   *     limit: 5,
   *     order: 'asc'
   *   });
   *   // returns the 5 oldest messages from 'sent' folder
   * 
   */

  /**
   * Class: email.recipient
   *
   * Property: name
   *
   * Property: address
   */

  /**
   * Class: email.draft
   */
  privateClient.declareType('draft', {
    type: 'object',
    properties: {

      /**
       * Property: to
       * Array of recipients (<email.recipient> objects).
       */
      to: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: {
              type: "string",
              required: true
            },
            address: {
              type: "string",
              required: true
            }
          }
        }
      },

      /**
       * Property: cc
       * Array of carbon copy recipients (<email.recipient> objects).
       */
      cc: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: {
              type: "string",
              required: true
            },
            address: {
              type: "string",
              required: true
            }
          }
        }
      },

      /**
       * Property: bcc
       * Array of blind carbon copy recipients (<email.recipient> objects).
       */
      bcc: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: {
              type: "string",
              required: true
            },
            address: {
              type: "string",
              required: true
            }
          }
        }
      },

      /**
       * Property: subject
       * Message subject.
       */
      subject: {
        type: 'string'
      },

      /**
       * Property: body
       * Message body.
       */
      body: {
        type: 'string'
      },

      /**
       * Property: date
       * Message date.
       * For a draft this represents the last time the draft was saved.
       */
      date: {
        type: 'date'
      },

      encrypt: {
        type: 'boolean',
        'default': false
      },

      sign: {
        type: 'boolean',
        'default': false
      }
    }
  });

  /**
   * Class: email.message
   *
   * Represents a received or sent message.
   *
   * Inherits from <email.draft>.
   *
   * Requires the following properties to be set:
   *  - <email.draft.to>,
   *  - <email.draft.subject>,
   *  - <email.draft.body> and
   *  - <email.draft.date> 
   */
  privateClient.declareType('message', {
    extends: 'draft',
    required: ['to', 'subject', 'body', 'date']
  });

  /**
   * Class: email.account
   *
   * Represents an account's basic metadata.
   *
   */
  privateClient.declareType('account', {
    type: 'object',
    properties: {
      /**
       * Property: name
       * The account owner's name.
       * This name is used as the sender name for outgoing messages.
       */
      name: { type: 'string' },
      /**
       * Property: address
       * The address associated with this account.
       * Will be used as the sender address for outgoing messages.
       */
      address: { type: 'string' }
    }
  });

  /**
   * Class: email.smtp-credentials
   */
  privateClient.declareType('smtp-credentials', {
    type: 'object',
    properties: {
      /**
       * Property: host
       */
      host: { type: 'string' },
      /**
       * Property: username
       */
      username: { type: 'string' },
      /**
       * Property: password
       */
      password: { type: 'string' },
      /**
       * Property: port
       */
      port: { type: 'number' },
      /**
       * Property: secure
       */
      secure: { type: 'boolean' },
    }
  });

  /**
   * Class: email.imap-credentials
   */
  privateClient.declareType('imap-credentials', {
    type: 'object',
    properties: {
      host: { type: 'string' },
      username: { type: 'string' },
      password: { type: 'string' },
      port: { type: 'number' },
      secure: { type: 'boolean' },
    }    
  });

  function addressToKey(address) {
    return address.replace(/@/g, '-at-') + '/';
  }

  function sortAsc(a, b) { return a > b ? -1 : b > a ? 1 : 0; } 
  function sortDesc(a, b) { return a < b ? -1 : b < a ? 1 : 0; }

  var dateIndexMethods = {
    byDate: function(direction, limit) {
      var result = [];
      var sort = function(a) {
        return a.sort('asc' ? sortAsc : sortDesc);
        :
        
      };

      // FIXME: all this can be greatly simplified by abstraction.

      var fetchYear = function(years) {
        var year = years.shift();
        return this.getListing(year + '/').
          then(sort).
          then(function(months) {
            return fetchMonth(year, months);
          }).
          then(function() {
            if(result.length < limit) return fetchYear(years);
          });
      }.bind(this);

      var fetchMonth = function(year, months) {
        var month = months.shift();
        return this.getListing(year + '/' + month + '/').
          then(sort).
          then(function(days) {
            return fetchDay(year, month, days);
          }).
          then(function() {
            if(result.length < limit) return fetchMonth(year, months);
          });
      }.bind(this);

      var fetchDay = function(year, month, days) {
        var day = days.shift();
        return this.getListing(year + '/' + month + '/' + day + '/').
          then(sort).
          then(function(messageIds) {
            return fetchMessage(year, month, day, messageIds);
          }).
          then(function() {
            if(result.length < limit) return fetchDay(year, month, days);
          });
      };

      var fetchMessage = function(year, month, day, messageIds) {
        var messageId = messageIds.shift();
        return this.getObject(year + '/' + month + '/' + day + '/' + messageId).
          then(function(message) {
            result.push(message);
          }).
          then(function() {
            if(result.length < limit) return fetchMessage(year, month, day, messageIds);
          });
      };

      return getListing().then(sort).then(fetchYear);
    },

    storeByDate: function(type, date, id, object) {
      this._attachType(type, object);
      this.validate(object);
      var basePath = [
        message.date.getUTCYear() + 1900,
        message.date.getUTCMonth() + 1,
        message.date.getUTCDate()
      ].join('/');
      var fileName = [
        message.date.getUTCHours(),
        message.date.getUTCMinutes(),
        message.date.getUTCSeconds()
      ].join('-') + '-' + id;
      return this.storeObject(type, basePath + '/' + fileName, object);
    }
  };

  /**
   * Method: openMailbox
   *
   * returns a <MailboxScope>.
   */
  var openMailbox = function(name) {
    var mailbox = privateClient.scope('mailbox/' + encodeURIComponent(name));
    mailbox.name = name;
    mailbox.extend(mailboxMethods);
    mailbox.pool = mailbox.scope('pool/').extend(dateIndexMethods);
    return mailbox;
  }

  /**
   * Class: MailboxScope
   *
   *   Represents a mailbox.
   *
   *
   * Property: name
   *   Name of the mailbox
   *
   *
   * Property: pool
   *   Direct access to the message pool (a <DateIndexedScope>)
   */

  var mailboxMethods = {

    /**
     * Method: store
     *
     * Takes a <email.message> object and stores it.
     */
    store: function(message) {
      return this.pool.storeByDate('message', message.date, message.messageId, message);
    },

    /**
     * 
     */
    list: function(options) {
      if(! options) options = {};
      return this.scope('pool/').byDate(
        options.order || 'desc',
        options.limit || 50
      );
    },

    unread: function() {
      return this.getObject('unread-index');
    }
  };

  return {
    exports: {

      /**
       * Object: email.credentials
       */
      credentials: privateClient.scope('credentials/').extend({
        getCurrent: function() {
          console.log('getCurrent');
          return this.getObject('current').then(function(account) {
            console.log('account', account);
            return (account && account.address) ?
              this.getAccount(account.address) : undefined;
          }.bind(this));
        },

        setCurrent: function(account) {
          return this.storeObject('account', 'current', account);
        },

        removeCurrent: function() {
          return this.remove('current');
        },

        getAccount: function(address) {
          console.log('address', address);
          var accountScope = this.scope(addressToKey(address));
          return accountScope.getListing('').then(function(keys) {
            // don't return empty accounts, but instead 'undefined'.
            if((!keys) || Object.keys(keys).length === 0) {
              return undefined;
            } else {
              var promise = promising();
              var items = {};
              var n = keys.length, i = 0;
              function oneDone(key, value) {
                console.log('got item', key, value);
                items[key] = value;
                i++;
                if(i == n) promise.fulfill(items);
              }
              keys.forEach(function(key) {
                accountScope.getObject(key).then(function(value) {
                  oneDone(key, value);
                }, function(error) {
                  console.error("failed to get account part '" + key + "': ", error, error.stack);
                  oneDone(key, undefined);
                });
              });
              return promise;
            }
          });
        },

        saveAccount: function(account) {
          var promise = promising();
          if(! account.actor.address) {
            promise.reject(["Can't save account without actor.address!"]);
            return promise;
          }
          var files = [];
          [['account', 'actor'],
           ['smtp-credentials', 'smtp'],
           ['imap-credentials', 'imap']
          ].forEach(function(fileDef) {
            if(account[fileDef[1]]) {
              files.push(fileDef.concat([account[fileDef[1]]]));
            }
          });
          console.log('files is', files);
          var accountScope = this.scope(addressToKey(account.actor.address));
          console.log('account SCOPE', accountScope);
          var errors = [];
          var n = files.length, i = 0;
          function oneDone() {
            i++;
            console.log('oneDone', i, '/', n);
            if(i == n) {
              promise.fulfill(errors);
            }
          }
          function oneFailed(error) {
            errors.push(error);
            oneDone();
          }
          for(var j=0;j<n;j++) {
            console.log('storing', files[j]);
            accountScope.storeObject.apply(accountScope, files[j]).
              then(oneDone, oneFailed);
          }
          return promise;
        },

        removeAccount: function(address) {
          var accountScope = this.scope(addressToKey(address));
          return accountScope.getListing('').then(function(items) {
            var promise = promising();
            var n = items.length, i = 0;
            var errors = [];
            function oneDone() {
              i++;
              if(i == n) promise.fulfill(errors);
            }
            function oneFailed(error) {
              errors.push(error);
              oneDone();
            }
            items.forEach(function(item) {
              accountScope.remove(item).then(oneDone, oneFailed);
            });
          });
        }
      }),

      /**
       * Object: email.drafts
       */
      drafts: privateClient.scope('drafts/').extend({
        /**
         * Method: getLatest
         *
         * Get latest draft.
         */
        getLatest: function() {
          return this.getObject('latest');
        },

        /**
         * Method: saveLatest
         *
         * Save given draft as latest one.
         *
         * Parameters:
         *   draft - A <email.draft> Object
         */
        saveLatest: function(draft) {
          return this.storeObject('draft', 'latest', draft);
        },

        removeLatest: function() {
          return this.remove('latest');
        }
      }),

      mailbox: openMailbox
    }
  };
});
