
var http = require('http');
var fs = require('fs');
var phantom = require('phantom');
var url = require('url');
var mkdirp = require('mkdirp');

var SERVER_URL = 'http://127.0.0.1/phantomjs-seo/#!';

phantom.create(function(ph) {
  http.createServer(function (req, res) {

    var path = url.parse('http://' + req.url).pathname;

    //TODO: Exclude non html requests
    var parts = path.split('.');
    if(parts.length > 1) {
      res.writeHead(404, {'Content-Type': 'text/plain'});
      res.write(path + ' not found\n');
      return res.end();
    }

    var file = './static' + path +
      (path.slice(-1) === '/' ? 'index.html' : '.html');

    fs.exists(file, function (exists) {
      console.log('File ' + file + ' ' + (exists ? 'exists' : 'does not exist'));
      if(exists) {
        // Serve the file
        res.writeHead(200, {'Content-Type': 'text/html'});
        var fileStream = fs.createReadStream(file);
        fileStream.pipe(res);
      }
      else {
        // Create a cached version and serve the file
        ph.createPage(function(page) {
          page.open(SERVER_URL + path, function(status) {
          console.log('Open site: ', SERVER_URL + path, ' >> ', status);

            if (status == 'success') {
              var delay;
              var it = 50;
              var checker = (function() {
                it--;
                if(!it) {
                  clearTimeout(delay);
                  res.writeHead(503, {'Content-Type': 'text/plain'});
                  res.end('503 Service Unavailable');
                  return;
                }
                var html = page.evaluate(function () {
                  var body = document.getElementsByTagName('body')[0];
                  if(body.getAttribute('data-status') === 'ready') {
                    return document.querySelectorAll('html')[0].outerHTML;
                  }
                },
                function(result) {
                  if(result) {
                    clearTimeout(delay);
                    // console.log(result);
                    res.writeHead(200, {'Content-Type': 'text/html'});
                    res.end(result);

                    var idx = file.lastIndexOf('/');
                    var dirs = file.substr(0, idx);

                    mkdirp(dirs, function (err) {
                      if (err) {
                        return console.error(err);
                      }
                      console.log('Created ' + dirs + ' dir');
                      // Save html (result) to file
                      fs.writeFile(file, result, function(err) {
                        if(err) {
                          // TODO: Create parent directories
                          console.log(err);
                        } else {
                          console.log('File ' + file + ' was saved');
                        }
                      });
                    });
                  }
                });
              });
              delay = setInterval(checker, 100);
            }
            else {
              res.writeHead(404, {'Content-Type': 'text/plain'});
              res.write(path + ' not found\n');
              res.end();
            }
          });
        });
      }

      // res.writeHead(200, {'Content-Type': 'text/html'});
      // res.write('Crawler server (NODEJS - localhost:8000)<br/>');
      // res.write('File ' + file + ' ' + (exists ? 'exists' : 'does not exist'));
      // res.end('');

    });

  })
  .listen(8000, function () {
    console.log('Server listening on 8000...');
  });
});

