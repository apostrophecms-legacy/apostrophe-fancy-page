var async = require('async');
var _ = require('lodash');
var extend = require('extend');

module.exports = fancyPage;

function fancyPage(options, callback) {
  return new fancyPage.FancyPage(options, callback);
}

fancyPage.FancyPage = function(options, callback) {
  var self = this;

  // "Protected" properties. We want modules like the blog to be able
  // to access these, thus no variables defined in the closure
  self._apos = options.apos;
  self._pages = options.pages;
  self._app = options.app;
  self._options = options;
  self._schemas = options.schemas;

  self.childTypes = options.childTypes;
  self.descendantTypes = options.descendantTypes;

  // If set to true this type of page is always an "orphan"
  // (hidden from conventional navigation menus, but accessible)
  self.orphan = options.orphan;

  // Mix in the ability to serve assets and templates
  self._apos.mixinModuleAssets(self, 'fancyPage', __dirname, options);

  // These are "public" so the object can be passed directly to pages.addType
  self.name = options.name;
  if (!options.name) {
    throw "You must set the name option when calling the FancyPage superclass constructor";
  }
  self.label = options.label;
  if (!self.label) {
    throw "You must set the label option when calling the FancyPage superclass constructor";
  }
  self.pluralLabel = options.pluralLabel || (self.label + 's');

  self._typeCss = self._apos.cssName(self.name);

  // All partials generated via self.renderer can see these properties
  self._rendererGlobals = options.rendererGlobals || {};

  self._action = '/apos-' + self._apos.cssName(self.name);

  extend(true, self._rendererGlobals, {
    type: _.pick(self, [ 'name', 'label', '_action' ])
  });

  self.setBridge = function(modules) {
    self._bridge = modules;
  };


  // self.schema = extra fields
  self.schema = self._schemas.compose(options);

  // SEARCH AND VERSIONING SUPPORT

  // The default properties for fancy pages are already covered by the
  // default properties for pages in general. Extend this to add more
  // lines of diff-friendly text representing metadata relating to
  // this type of page. Always call the superclass version
  self.addDiffLines = function(page, lines) {
  };

  // Improve the search index by adding custom searchable texts.
  // Note that you do not need to override this method just to make
  // schema properties of type "text", "select", "area" or "singleton"
  // searchable, or to cover "title" and "tags."
  //
  // Extend this to add more search texts representing metadata relating to
  // this type of page. Example: texts.push({ weight: 20, text: page.address })
  //
  // The default search engine is very simple: searches that match
  // something weighted greater than 10 appear before everything else.

  self.addSearchTexts = function(page, texts) {
  };

  // Add a listener so we can contribute our own metadata to the set of lines used
  // for the diffs between versions. Pass an inline function so that self.addDiffLines
  // can be changed by a subclass of fancyPage (if we just assign it now, it'll be
  // the default version above no matter what).

  self._apos.addListener('diff', function(page, lines) {
    if (page.type === self.name) {
      self.addDiffLines(page, lines);
    }
  });

  self._apos.addListener('index', function(page, lines) {
    if (page.type === self.name) {
      self._schemas.indexFields(self.schema, page, lines);
      // Custom search indexing
      self.addSearchTexts(page, lines);
    }
  });

  // Push our assets at the last possible moment. This allows us
  // to make decisions about the data to be passed to assets based
  // on other modules that may not have been initialized yet when
  // we were first constructed

  self._apos.on('beforeEndAssets', function() {
    self.pushAllAssets();
  });

  self.pushAllAssets = function() {
    // Make sure that aposScripts and aposStylesheets summon our
    // browser-side UI assets for managing fancy pages

    // CUSTOM PAGE SETTINGS TEMPLATE
    self.pushAsset('template', options.pageSettingsTemplate || 'pageSettings', {
      when: 'user',
      data: {
        fields: self.schema,
        name: self.name,
        label: self.label,
        action: self._action,
        pageSettingsClass: 'apos-page-settings-' + self._apos.cssName(self.name)
      }
    });

    self.pushAsset('script', 'editor', { when: 'user' });
    self.pushAsset('script', 'content', { when: 'always' });

    // Modules that subclass fancy page more than once may wish to
    // push alternate editor and content javascript for the front end.
    // We push these in addition to, not instead of, the usual
    // base versions above so that they can subclass successfully
    if (options.editorScript && (options.editorScript !== 'editor')) {
      self.pushAsset('script', options.editorScript, { when: 'user' });
    }
    if (options.contentScript && (options.contentScript !== 'content')) {
      self.pushAsset('script', options.contentScript, { when: 'always' });
    }

    // We've decided not to push stylesheets that live in the core
    // Apostrophe modules, because we prefer to write LESS files in the
    // sandbox project that can share imports. But you can add these calls
    // back to your subclasses if you like keeping the LESS files with
    // the modules.

    // self.pushAsset('stylesheet', 'editor', { when: 'user' });
    // self.pushAsset('stylesheet', 'content', { when: 'always' });
  };


  // END OF MANAGER FUNCTIONALITY

  // Returns pages of this type that the current user is permitted to visit.
  //
  // Normally viewers reach these by browsing, however in some cases
  // you will want to know about all of the pages of a particular type.
  //
  // The result passed as the second argument to the callback is an
  // object with a "pages" property containing the pages. (Although
  // we currently pass no other properties, we may in the future,
  // and wish to be forwards-compatible.)
  //
  // CRITERIA
  //
  // The criteria argument is combined with the standard MongoDB
  // criteria for fetching pages via MongoDB's `$and` keyword.
  // This allows you to use any valid MongoDB criteria when
  // fetching pages.
  //
  // OPTIONS
  //
  // The `options` argument provides *everything offered by
  // the `apos.get` method's `options` argument*, plus the following:
  //
  // PERMALINKING
  //
  // The slug property is copied to the url property for the convenience
  // of code that deals with both snippets and pages.
  //
  // JOINS
  //
  // Carries out joins as specified by the schema.

  self.get = function(req, userCriteria, optionsArg, callback) {
    var options = {};
    var filterCriteria = {};
    var results = null;
    extend(true, options, optionsArg);

    // Default sort is alpha
    if (options.sort === undefined) {
      options.sort = { sortTitle: 1 };
    }
    // filterCriteria is the right place to build up criteria
    // specific to this method; we'll $and it with the user's
    // criteria before passing it on to apos.get
    filterCriteria.type = self.name;
    var fetch = options.fetch;
    var permalink = options.permalink;

    // Final criteria to pass to apos.get
    var criteria = {
      $and: [
        userCriteria,
        filterCriteria
      ]
    };

    return async.series([ query, join, permalinker ], function(err) {
      return callback(err, results);
    });

    function query(callback) {
      return self._apos.get(req, criteria, options, function(err, resultsArg) {
        if (err) {
          return callback(err);
        }
        results = resultsArg;
        return callback(null);
      });
    }

    function join(callback) {
      // Watch out for the getDistinct option which delivers an array
      // and isn't interested in joins
      if (Array.isArray(results)) {
        return setImmediate(callback);
      }
      var withJoins = options.withJoins;
      return self._schemas.join(req, self.schema, results.pages, withJoins, callback);
    }

    function permalinker(callback) {
      // Watch out for the getDistinct option which delivers an array
      // and isn't interested in permalinks
      if (Array.isArray(results)) {
        return setImmediate(callback);
      }
      _.each(results.pages, function(page) {
        page.url = self._apos.slugToUrl(page.slug);
      });
      return callback(null);
    }
  };

  // Get just one page. Otherwise identical to get. Invokes get,
  // so you only need to override one.

  self.getOne = function(req, criteria, optionsArg, callback) {
    var options = {};
    extend(true, options, optionsArg);
    options.limit = 1;
    if (!options.skip) {
      options.skip = 0;
    }
    return self.get(req, criteria, options, function(err, results) {
      if (err) {
        return callback(err);
      }
      return callback(err, results.pages[0]);
    });
  };

  /**
   * Store a page of this type. By default this just wraps apos.putPage.
   * All parameters are required. This method is called when the user
   * saves page settings for a page of this type or creates a new page
   * of this type. Note that empty beforePutOne and afterPutOne methods are
   * provided for your overriding convenience. Keep in mind
   * that in most cases adding fields to the schema is easier.
   *
   * If you are creating a new page, you must pass in the parent page object
   * via options.parent. If you pass "undefined" as the "slug" argument
   * a slug is generated for you based on the title and the slug of
   * the parent page (recommended). Never attempt to define the _id property
   * when storing a new page, allow putOne to determine one for you.
   */

  self.putOne = function(req, slug, options, page, callback) {
    page.type = self.name;
    return async.series({
      newPage: function(callback) {
        // If this is an existing page, or the developer has already
        // set the rank property (and presumably level and path),
        // we butt out and don't look at options.parent
        if (page._id || page.rank) {
          return callback(null);
        }
        if (!options.parent) {
          return callback('You must specify the parent page via the parent option when calling putOne for a new fancy page.');
        }
        var slug = slug || page.slug || options.parent.slug + '/' + self._apos.slugify(page.title);
        if (!page.slug) {
          page.slug = slug;
        }
        if (!page.path) {
          page.path = options.parent.path + '/' + self._apos.slugify(page.title);
        }
        page.level = options.parent.level + 1;
        if (page.rank !== undefined) {
          return callback(null);
        }
        return self._pages.getNextRank(options.parent, function(err, rank) {
          if (err) {
            return callback(err);
          }
          page.rank = rank;
          return callback(null);
        });
      },
      beforePutOne: function(callback) {
        return self.beforePutOne(req, slug, options, page, callback);
      },
      putOne: function(callback) {
        return self._apos.putPage(req, slug, options, page, callback);
      },
      afterPutOne: function(callback) {
        return self.afterPutOne(req, slug, options, page, callback);
      }
    }, callback);
  };

  /**
   * Automatically invoked before putOne() proceeds. Empty by default
   * for your overriding convenience.
   */
  self.beforePutOne = function(req, slug, options, page, callback) {
    return callback(null);
  };

  /**
   * Automatically invoked after putOne() updates the page. Empty by default
   * for your overriding convenience.
   */
  self.afterPutOne = function(req, slug, options, page, callback) {
    return callback(null);
  };

  // This is a loader function, for use with the `load` option of
  // the pages module's `serve` method. apostrophe-sites wires it up
  // automatically.

  self.loader = function(req, callback) {
    if (!options.greedy) {
      if (!req.page) {
        return callback(null);
      }
    }

    if (!req.bestPage) {
      return callback(null);
    }

    // If the page type doesn't share our type name
    // this page isn't relevant for us
    if (req.bestPage.type !== self.name) {
      return callback(null);
    }

    // Provide a custom context menu for this page type if specified
    // and editable
    if (self._options.contextMenu && req.bestPage._edit) {
      req.contextMenu = self._options.contextMenu;
    }

    async.series([joins, dispatch], callback);

    function joins(callback) {
      var withJoins = options.withJoins;
      return self._schemas.join(req, self.schema, [ req.bestPage ], null, callback);
    }

    function dispatch(callback) {
      // We consider a partial match to be good enough, depending on the
      // remainder of the URL
      req.page = req.bestPage;
      self.dispatch(req, callback);
    }
  };

  // Decide what to do based on the remainder of the URL. The default behavior is
  // just to render the page template with the same name as the module, and that
  // is usually what you want, even for fancyPages. But you can change this
  // behavior, see commented-out examples below.

  self.dispatch = function(req, callback) {
    // Now we know it's of the right type.

    // If I want to, I can override this to render via
    // a custom method. If I use self.renderer I can render
    // teplates that live in this module's views folder,
    // rather than templates in the project-level views/pages folder:

    // req.template = self.renderer('index')

    // I could also send a 404:
    // req.notfound = true;

    // Or redirect somewhere:
    // req.redirect = 'http://somewhere....';

    // The default behavior is to render the page template matching
    // the module name.

    return callback(null);
  };

  // Sanitize newly submitted page settings (never trust a browser)
  extend(true, self, {
    settings: {
      sanitize: function(req, data, callback) {
        var ok = {};
        return self._schemas.convertFields(req, self.schema, 'form', data, ok, function(err) {
          return callback(err, ok);
        });
      }
    }
  });

  // Get ready to push information about this page type to the browser

  var browser = options.browser || {};
  self._browser = browser;
  var pages = browser.pages || 'aposPages';
  var construct = getBrowserConstructor();

  // Register this page type on the server
  self._pages.addType(self);

  // Data for the browser
  var args = {
    name: self.name,
    label: self.label,
    action: self._action,
    schema: self.schema,
    typeCss: self._typeCss,
    orphan: self.orphan,
    childTypes: self._options.childTypes,
    descendantTypes: self._options.descendantTypes
  };
  extend(true, args, browser.options || {});

  // Synthesize a constructor for this type on the browser side if there
  // isn't one. This allows trivial subclassing of snippets for cases where
  // no custom browser side code is actually needed
  self._apos.pushGlobalCallWhen('user', 'apos.afterYield(?, function() { AposFancyPage.subclassIfNeeded(?, ?, ?); @.replaceType(?, new @(?)) })', browser.afterYield, getBrowserConstructor(), getBaseBrowserConstructor(), args, pages, self.name, construct, args);

  function getBrowserConstructor() {
    return self._browser.construct || 'Apos' + self.name.charAt(0).toUpperCase() + self.name.substr(1);
  }

  // Figure out the name of the base class constructor on the browser side. If
  // it's not available set a dummy name; this will work out OK because this
  // typically means subclassing was done explicitly on the browser side.
  function getBaseBrowserConstructor() {
    return self._browser.baseConstruct || 'AposPresumablyExplicit';
  }

  if (callback) {
    // Invoke callback on next tick so that the constructor's return
    // value can be assigned to a variable in the same closure where
    // the callback resides
    process.nextTick(function() { return callback(null); });
  }
};
