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
      return aposSchemas.convertFields($details, self.schema, data, function(err) {
        return callback(err, data);
      });
    },
    unserialize: function(data, $el, $details, callback) {
      return aposSchemas.populateFields($details, self.schema, data, callback);
    }
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

