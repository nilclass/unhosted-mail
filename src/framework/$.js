
window.$ = document.querySelector.bind(document);
window.$$ = function() {
  var element;
  if(typeof(arguments[0]) == 'object') {
    element = arguments[0];
    selector = arguments[1];
  } else {
    element = document;
    selector = arguments[1];
  }
  return Array.prototype.slice.call(element.querySelectorAll(selector));
};
