
/**
 * Module dependencies.
 */

var stylus = require('../')
  , fs = require('fs');

// integration cases

addSuite('integration', readDir('test/cases'), function(test){
  var path = 'test/cases/' + test + '.styl'
    , styl = readFile(path)
    , css = readFile('test/cases/' + test + '.css')
    , style = stylus(styl)
        .set('filename', path)
        .include(__dirname + '/images')
        .include(__dirname + '/cases/import.basic')
        .define('url', stylus.url());

  if (~test.indexOf('compress')) style.set('compress', true);
  if (~test.indexOf('include')) style.set('include css', true);
  if (~test.indexOf('prefix.')) style.set('prefix', 'prefix-');
  if (~test.indexOf('hoist.')) style.set('hoist atrules', true);

  if (~test.indexOf('resolver')) {
    style.set('resolve url', true);
    style.define('url', stylus.resolver());
  }

  style.render(function(err, actual){
    if (err) throw err;
    actual.trim().should.equal(css);
  });
}, ['index']);

// converter cases

addSuite('converter', readDir('test/converter', '.css'), function(test){
  var path = 'test/converter/' + test + '.styl'
    , styl = readFile(path)
    , css = readFile('test/converter/' + test + '.css');

  stylus.convertCSS(css).trim().should.equal(styl);
});

// deps resolver cases

addSuite('dependency resolver', readDir('test/deps-resolver'), function(test){
  var path = 'test/deps-resolver/' + test + '.styl'
    , styl = readFile(path)
    , deps = readFile('test/deps-resolver/' + test + '.deps')
    , style = stylus(styl).set('filename', path);

  style.deps().join('\n').trim().should.equal(deps);
});

// sourcemap cases

addSuite('sourcemap', readDir('test/sourcemap'), function(test){
  var inline = ~test.indexOf('inline')
    , path = 'test/sourcemap/' + test + '.styl'
    , styl = readFile(path)
    , style = stylus(styl).set('filename', path).set('sourcemap',
      { inline: inline, sourceRoot: '/', basePath: 'test/sourcemap' })
    , expected = readFile(path.replace('.styl', inline ? '.css' : '.map'));

  style.render(function(err, css) {
    if (err) throw err;
    if (inline) {
      style.sourcemap.sourcesContent.should.not.be.empty;
      css.should.include('sourceMappingURL=data:application/json;base64,');
    } else {
      style.sourcemap.should.eql(JSON.parse(expected));
    }
  });
});

// JS API

describe('JS API', function(){
  it('define a variable with object as hash', function(){
    stylus('body { foo: test-obj.baz.foo.quz; bar: test-obj.bar[0].foo  }')
      .set('compress', true)
      .define('test-obj', {
        bar: [{ foo: 1 }],
        baz: {
          foo: { quz: 'quz' },
        }
      }, true).render().should.equal("body{foo:'quz';bar:1}");
  });

  it('define a variable with object as list', function(){
    stylus('body { foo: test-obj  }')
      .set('compress', true)
      .define('test-obj', {
        baz: {
          foo: { quz: 'quz' }
        }
      }).render().should.equal("body{foo:baz foo quz 'quz'}");
  });

  it('use variable from options object', function(){
    stylus
      .render(
        'body { foo: bar  }',
        {
          compress: true,
          globals: {
            'bar': 'baz'
          }
        }
      ).should.equal("body{foo:baz}");
  });

  it('use functions from options object', function(){
    stylus
      .render(
        'body { foo: add(4, 3); bar: something() }',
        {
          compress: true,
          functions: {
            add: function(a, b) {
              return a.operate('+', b);
            },
            something: function() {
              return new stylus.nodes.Ident('foobar');
            }
          }
        }
      ).should.equal("body{foo:7;bar:foobar}");
  });

  it('use plugin(s) from options object', function(){
    var plugin = function(key, value) {
      return function(style) {
        style.define(key, new stylus.nodes.Literal(value));
      }
    };

    stylus('body { foo: bar  }', {
      compress: true,
      use: plugin('bar', 'baz')
    }).render().should.equal('body{foo:baz}');

    stylus('body { foo: bar; foo: qux  }', {
      compress: true,
      use: [plugin('bar', 'baz'), plugin('qux', 'fred')]
    }).render().should.equal('body{foo:baz;foo:fred}');
  });

  it('import cloning with cache', function(){
    var path = __dirname + '/cases/import.basic/'
      , styl = readFile(path + 'clone.styl')
      , css = 'body{background:linear-gradient(from bottom,#f00,#00f)}';

    stylus(styl, { compress: true })
      .render().should.equal(css);

    stylus('@import "clone"', { compress: true, paths: [path] })
      .render().should.equal(css);
  });

  it('import cloning with cache #2', function(){
    var path = __dirname + '/cases/import.basic/'
      , styl = fs.readFileSync(path + 'clone2.styl', 'utf-8').replace(/\r/g, '')
      , css = 'body{color:#f00}body{color:#00f}body{color:#00f}body{color:#00f}body{color:#008000}';

    stylus(styl, { compress: true })
      .render().should.equal(css);

    stylus('@import "clone2"', { compress: true, paths: [path] })
      .render().should.equal(css);
  });
});

// helper functions

function addSuite(desc, cases, fn, ignore) {
  describe(desc, function(){
    cases.forEach(function(test){
      var name = normalizeName(test);

      if (ignore && ~ignore.indexOf(name)) return;
      it(name, fn.bind(this, test));
    });
  });
}

function readDir(dir, ext){
  ext = ext || '.styl';
  return fs.readdirSync(dir).filter(function(file){
    return ~file.indexOf(ext);
  }).map(function(file){
    return file.replace(ext, '');
  });
}

function readFile(path){
  return normalizeContent(fs.readFileSync(path, 'utf-8'));
}

function normalizeName(name){
  return name.replace(/[-.]/g, ' ');
}

function normalizeContent(str){
  return str.replace(/\r/g, '').trim();
}
