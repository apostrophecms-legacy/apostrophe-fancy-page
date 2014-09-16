// JavaScript which enables editing of this module's content belongs here.

function AposFancyPage(options) {
  var self = this;

  // These are all provided via pushGlobalCallWhen in apostrophe-fancy-page/index.js
  self._action = options.action;
  self.schema = options.schema;
  self._typeCss = options.typeCss;
  self.orphan = options.orphan;
  self.childTypes = options.childTypes;
  self.descendantTypes = options.descendantTypes;

  // PAGE SETTINGS FOR THIS TYPE

  self.settings = {
    serialize: function($el, $details, callback) {
      var data = {};
      return async.series({
        convert: function(callback) {
          return aposSchemas.convertFields($details, self.schema, data, callback);
        },
        customValidate: function(callback) {
          return self.validate($el, $details, data, $el.data('new') ? 'insert' : 'update', callback);
        }
      }, function(err) {
        return callback(err, data);
      });
    },
    unserialize: function(data, $el, $details, callback) {
      return aposSchemas.populateFields($details, self.schema, data, callback);
    }
  };

  // This is a hook to do your own custom validation outside
  // of schemas.
  //
  // $el is the entire page settings modal. $details is the
  // div where your page-type-specific settings live.
  // data is a page object already populated by 'convertFields'
  // at this point. action is either "insert" or "update".
  //
  // If you are unsatisfied, invoke the callback with an
  // error, otherwise with null.
  //
  // We have a strong bias toward sanitizing the user's input
  // rather than rejecting it, but sometimes you must.

  self.validate = function($el, $details, data, action, callback) {
    return apos.afterYield(callback);
  };
}

// When we explicitly subclass fancyPage, there must also be a subclass on the browser
// side. However sometimes this subclass really has no unique work to do, so we can
// synthesize it automatically. Do so if no constructor for it is found.
//
// A call to this method is pushed to the browser by apostrophe-fancy-page/index.js

AposFancyPage.subclassIfNeeded = function(constructorName, baseConstructorName, options) {
  if (!window[constructorName]) {
    window[constructorName] = function(options) {
      var self = this;
      window[baseConstructorName].call(self, options);
    };
  }
};

