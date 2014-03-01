# apostrophe-fancy-page

This module lets you add custom properties to "regular pages" on your [Apostrophe](http://github.com/punkave/apostrophe-sandbox) CMS site. With this module, a page can have subpages and yet also have custom properties in the page settings dialog, including "joins" with other page types and snippet types, without writing extra JavaScript code.

**Table of Contents**
* [Adding Custom Properites](#adding-custom-properties)
* [Adding Joins](#adding-joins)
* [Custom Rendering](#custom-rendering)
* [Greedy Pages](#greedy-pages)
* [Passing Extra Information to Templates](#passing-extra-information-to-templates)

## Adding Custom Properties

Let's say we already have a page type called "Company," set up with the rest of our page types in `app.js`:

```javacript
  pages: [
    'home',
    'default',
    'company'
  ]
```

This is fine but we want to know the year each company was incorporated.

So let's subclass `apostrophe-fancy-page`:

```javascript
modules: {
  // Other modules go here
  company: {
    extend: 'apostrophe-fancy-page',
    name: 'company',
    label: 'Company',
    addFields: [
      {
        name: 'incorporated',
        label: 'Incorporated',
        type: 'integer'
      }
    ]
  }
}
```

**We also must create the folder `lib/modules/company` in our project.** This folder can start out empty and often stays that way.

Now restart your site and add a page with the "Company" page type. Boom! There's an "Incorporated" field in "Page Settings."

You can access this field in your templates:

    {{ page.typeSettings.incorporated }}

"OK, but what other field types are there?" `apostrophe-fancy-page` uses Apostrophe schemas. You can do anything that is [supported by Apostrophe schemas](http://github.com/punkave/apostrophe-schemas). It's exactly like adding fields to snippet subclasses like `apostrophe-blog` and `apostrophe-events`.

## Adding Joins

You can add joins too. They work [exactly as documented here](http://github.com/punkave/apostrophe-schemas). You can join with other fancy page types, or with snippet instance types like `blogPost`.

## Custom Rendering

By default, you'll just write a `company.html` in your project's `views/pages` folder, like you would with regular page types.

However, the `apostrophe-fancy-pages` module is all hooked up to let you override the `dispatch` method to change this behavior.

To do that you'll need an `index.js` file in your `lib/modules/company` folder, with a constructor for your module. After you invoke the superclass constructor you can provide an override of the dispatcher:

```javascript
module.exports = company;

function company(options, callback) {
  return new company.Company(options, callback);
}

company.Company = function(options, callback) {
  var self = this;

  module.exports.Super.call(this, options, null);

  self.dispatcher = function(req, callback) {
    return self.renderer('index.html');
  };

  if (callback) {
    process.nextTick(function() { return callback(null); });
  }
};
```

In this example, the dispatcher has been overridden to render `lib/modules/company/views/index.html` instead of `views/pages/company.html`.

You can do other nifty tricks in your dispatcher:

```javascript
// Let's turn it into a 404
req.notfound = true;

// Or, redirect somewhere
req.redirect = 'http://somewhere';
```

## Greedy Pages

By default, if the slug of your page is:

    /xyzcorp

And the URL is:

    /xyzcorp/foobar

And there is no other page at /xyzcorp/foobar, then the user will get a 404 Not Found error.

You can change this behavior. If you set `greedy: true` when configuring your module, then if no other page matches more exactly and the URL begins with `/xyzcorp/`, your page will still appear.

In your dispatcher, you can access the rest of the URL (the part after `/xyzcorp`) via `req.remainder`. You can use that to decide to render things differently.

## Passing Extra Information to Templates

You can pass extra information to the page template by adding it as properties of the `req.extras` object. Any properties of that object are automatically visible to Nunjucks when the page is rendered.
