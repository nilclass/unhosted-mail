
var MailApp = function() {
  this.mailcache = new Mailcache();
  App.apply(this, arguments);
}

MailApp.prototype = Object.create(App.prototype);
MailApp.prototype.LAYOUT_CONTAINERS = ['header', 'content'];
MailApp.prototype.Router = MailRouter;

window.addEventListener('load', function() {
  window.app = new MailApp(window);
});
