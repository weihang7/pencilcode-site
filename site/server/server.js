#!/usr/bin/env python

/*
 * Maybe useful in translation.
import sys, os, cgi, re, json, stat, time
sys.path.append(os.path.dirname(__file__))
import config
rootcachename = os.path.join(config.cachedir, 'rootcache')
*/

var fs = require('fs');
var express = require('express');
var path = require('path');

function uri_without_query(uri) {
  return uri.split('?', 1)[0];
}

function splituri(uri) {
  var ret = [], i, uris = uri_without_query(uri).split('/');
  for (i = 0; i < uris.length; i++) {
    if (uris[i]) {
      ret.push(uris[i]);
    }
  }
  return ret;
}

function filename_from_uri(uri) {
  return splituri(uri).slice(1).join('/');
}

function format_from_uri(uri) {
  if ('load' == splituri(uri)[0]) {
    return 'json';
  } else if ('download' === splituri(uri)[0]) {
    return 'download';
  }
  return '';
}

app.get('/load', function (req, res) {
  request_uri = env['REQUEST_URI']
  host_name = env['HTTP_HOST']
  var filename;
  if (!req.query.file) {
    filename = filename_from_uri(request_uri);
  } else {
    filename = req.query.file;
  }
  var format;
  if (!req.query.format) {
    format = format_from_uri(request_uri);
  } else {
    filename = req.query.format;
  }
  var callback = req.query.callback;
  var tail = req.query.tail;
  var user = host_name.split('.').slice(0, -2).join('.');
  var domain = host_name.split('.').slice(-2).join('.');
  var origfilename = filename;
  if user.length === 0 {
    user = null;
  }
  
  // Doesn't js do weird stuff with try catch? I'm flabbergasted.
  try:
    tail = parseInt(tail)
  except:
    tail = None
  
  var isrootlisting = (user === null && filename === "" && format === "json");
  if (isrootlisting) {
    try:
      data = file(rootcachename, 'rb').read()
      res.set({
         'Cache-Control': 'no-cache, must-revalidate',
         'Content-Type': 'text/javascript'
      });
      if (callback) {
        return [callback, '(', data, ')'];
      } else {
        return [data];
      }
    except:
     pass
  }
  
  function jsonout(dict) {
    var dumps = JSON.stringify(dict);
    if (isrootlisting) {
      cache = file(rootcachename, 'wb');
      cache.write(dumps);
      cache.close();
    }
    if (callback) {
      return [callback, '(', dumps, ')'];
    } else {
      return [dumps];
    }
  }
  
  function errorexit(s):
    if format == 'json':
      start_response('200 OK', [
         ('Cache-Control', 'no-cache, must-revalidate'),
         ('Content-Type', 'text/javascript')
      ])
      return jsonout({'error': s})
    else:
      start_response('200 OK', [
         ('Content-Type', 'text/html')
      ])
      return ['<plaintext>', s]
  
  function mimetype(ext, filename, data=None):
    result = {
      'jpg'  : 'image/jpeg',
      'jpeg' : 'image/jpeg',
      'gif'  : 'image/gif',
      'png'  : 'image/png',
      'bmp'  : 'image/x-ms-bmp',
      'ico'  : 'image/x-icon',
      'htm'  : 'text/html',
      'html' : 'text/html',
      'txt'  : 'text/plain',
      'text' : 'text/plain',
      'css'  : 'text/css',
      'coffee' : 'text/coffeescript',
      'js'   : 'text/javascript',
      'xml'  : 'text/xml'
    }.get(ext, None)
    if result is None:
      result = 'text/x-turtlebits'
    if result.startswith('text'):
      result += ';charset=utf-8'
    return result
  
  # Validate a good username
  if user is not None:
    if not re.match(r'^[A-Za-z]\w{2,}$', user):
      return errorexit('bad username "%s"' % user)
    filename = os.path.join(user, filename)
  # Validate a good filename
  if (len(filename) and
      not re.match(r'^(?:[\w][\w\.\-]*)(?:/[\w][\w\.\-]*)*/?$', filename)):
    return errorexit('bad filename "%s"' % filename)
  if (len(filename) and
      not re.match(r'^(?:[\w][\w\.\-]*)(?:/[\w][\w\.\-]*)*/?$', filename)):
    return errorexit('bad filename "%s"' % filename)
  absfile = os.path.join(config.datadir, filename)
  if not absfile.startswith(config.datadir):
    return errorexit('illegal filename "%s"' % filename)
  
  function validnewfile(abs):
    while True:
      if os.path.isfile(abs):
        return False
      abs = os.path.dirname(abs)
      if not absfile.startswith(config.datadir):
        return False
      if os.path.isdir(abs):
        return True
  
  function direntry(absdir, filename):
    fn = os.path.join(absdir, filename)
    fs = os.stat(fn)
    (mode, ino, dev, nlink, uid, gid, size, atime, mtime, ctime) = fs
    modestr = ''
    if stat.S_ISDIR(mode): modestr += 'd'
    if mode & stat.S_IRUSR: modestr += 'r'
    if mode & stat.S_IWUSR: modestr += 'w'
    if mode & stat.S_IXUSR: modestr += 'x'
    mtime = fs.st_mtime
    if 'd' not in modestr and size == 0:
      mtime = 0
    return { 'name': filename, 'mode': modestr,
      'size': fs.st_size, 'mtime': mtime }
  
  function readtail(f, lines):
    if lines <= 0:
      return ''
    f.seek(0, 2)
    bytes = f.tell()
    size = lines
    block = -1
    while size > 0:
      truncate = min(0, bytes + block * 1024)
      f.seek(block * 1024 - truncate, 2) # from the end
      data = f.read(truncate + 1024)
      linesFound = data.count('\n')
      size -= linesFound
      block -= 1
      if truncate: break
    truncate = min(0, bytes + block * 1024)
    f.seek(block * 1024 - truncate, 2)
    while size < 0:
      f.readline()
      size += 1
    return f.read()
  
  function userhaskey(user):
    if not user:
      return False
    keydir = os.path.join(config.datadir, user, '.key')
    if not os.path.isdir(keydir):
      return False
    keys = os.listdir(keydir)
    return len(keys) > 0
  
  if format == 'json':
    haskey = userhaskey(user)
    if os.path.isfile(absfile):
      f = file(absfile, 'r')
      if tail is not None:
        data = readtail(f, tail)
      else:
        data = f.read()
      fs = os.fstat(f.fileno())
      (mode, ino, dev, nlink, uid, gid, size, atime, mtime, ctime) = (
          os.fstat(f.fileno()))
      f.close()
      ext = filename.rsplit('.', 1)[-1]
      mimet = mimetype(ext, absfile, data)
      start_response('200 OK', [
         ('Cache-Control', 'no-cache, must-revalidate'),
         ('Content-Type', 'text/javascript')
      ])
      return jsonout({'file': '/' + filename, 'data': data,
          'auth': haskey, 'mtime': fs.st_mtime, 'mime': mimet})
    if os.path.isdir(absfile):
      if len(filename) and not filename.endswith('/'):
        filename += '/'
      contents = os.listdir(absfile) or []
      contents = sorted([fn for fn in contents if not fn.startswith('.')])
      list = [direntry(absfile, n) for n in contents]
      start_response('200 OK', [
         ('Cache-Control', 'no-cache, must-revalidate'),
         ('Content-Type', 'text/javascript')
      ])
      return jsonout({'directory': '/' + filename,
                     'list': list,
                     'auth': haskey})
    if len(filename) and not filename.endswith('/') and validnewfile(absfile):
      start_response('200 OK', [
         ('Cache-Control', 'no-cache, must-revalidate'),
         ('Content-Type', 'text/javascript')
      ])
      return jsonout({'error': 'could not read file %s' % filename,
                     'newfile': True,
                     'auth': haskey,
                     'info': absfile})
    return errorexit('could not read file %s' % filename)
  
  if format == 'download' and os.path.isfile(absfile):
    shortfilename = re.sub('^.*/', '', filename)
    if tail is not None:
      data = readtail(file(absfile, 'r'), tail)
    else:
      data = file(absfile, 'r').read()
    start_response('200 OK', [
       ('Cache-Control', 'no-cache, must-revalidate'),
       ('Content-Type', 'application/octet-stream'),
       ('Content-Disposition', 'attachment; filename=%s' % shortfilename),
       ('Content-Length', '%d' % len(data))
    ])
    return data
  
  function wrapturtle(text):
    return (
    '<!doctype html>\n<html>\n<head>\n' +
    '<script src="http://%s/turtlebits.js"></script>\n' % (domain) +
    '</head>\n<body>\n<script type="text/coffeescript">\neval $.turtle()\n\n' +
    text + '\n</script>\n</body>\n</html>\n')
  
  if os.path.isfile(absfile):
    split = filename.rsplit('.', 1)
    ext = None if len(split) < 2 else split[-1]
    data = file(absfile, 'r').read()
    mt = mimetype(ext, absfile, data)
    # for turtlebits: if there is no extension and it looks like a non-HTML
    # text file, assume it is coffeescript that should be wrapped in HTML.
    if mt.startswith('text/x-turtlebits'):
      data = wrapturtle(data)
      mt = mt.replace('x-turtlebits', 'html')
    start_response('200 OK', [
       ('Cache-Control', 'no-cache'),
       ('Content-Type', mt)
    ])
    return data
  
  elif os.path.isdir(absfile) or not '/' in filename.rstrip('/'):
    if len(filename) and not filename.endswith('/'):
      start_response('301 Redirect', [('Location', request_uri + '/')])
      return []
    start_response('200 OK', [
       ('Cache-Control', 'no-cache'),
       ('Content-Type', 'text/html;charset=utf-8')
    ])
    result = []
    result.append('<title>%s</title>\n' % (request_uri))
    result.append('<style>\n')
    result.append('body { font-family:Arial,sans-serif; }\n')
    result.append('pre {\n')
    result.append('-moz-column-count:3;\n')
    result.append('-webkit-column-count:3;\n')
    result.append('column-count:3;\n')
    result.append('}\n')
    result.append('</style>\n')
    result.append(absfile)
    result.append('<h3>%s</h3>\n' % (env['HTTP_HOST'] + request_uri))
  
    contents = os.path.isdir(absfile) and os.listdir(absfile) or []
    contents = [fn for fn in contents if not fn.startswith('.')]
    result.append('<pre>\n')
    if len(request_uri.strip('/').split('/')) > 1:
      result.append('<a href="%s" style="background:yellow">Up to %s</a>\n' % (
        os.path.dirname(request_uri.rstrip('/')) + '/',
        os.path.dirname(request_uri.rstrip('/')) + '/'))
    for name in sorted(contents):
      af = os.path.join(absfile, name)
      if os.path.isdir(af) and not name.endswith('/'):
        name += '/'
      link = '<a href="%s">%s</a>' % (request_uri + name, name)
      if os.path.isfile(af):
        link += (' <a href="%s" style="color:lightgray" rel="nofollow">edit</a>'
                % ('/edit/' + filename + name))
      result.append(link + '\n')
    result.append('</pre>\n')
  
    if len(contents) == 0:
      result.append('(directory is empty)<br>\n')
    return result
  elif filename.endswith('/'):
    start_response('301 Redirect', [('Location',
        os.path.dirname(request_uri.rstrip('/')) + '/')])
    return []
  
  else:
    start_response('200 OK', [
       ('Cache-Control', 'no-cache'),
       ('Content-Type', 'text/html;charset=utf-8')
    ])
    result = []
    result.append('<pre>\n')
    result.append('No file %s found.\n\n' % origfilename)
    result.append('<a href="%s">Up to %s</a>\n' % (
        os.path.dirname(request_uri.rstrip('/')) + '/',
        os.path.dirname(request_uri.rstrip('/')) + '/'))
    if filename.rsplit('.', 1)[-1] in ['htm', 'html', 'js', 'css']:
      print
      result.append('<a href="%s" rel="nofollow">Create %s</a>\n' % (
          '/edit/' + origfilename, '/home/' + origfilename))
    result.append('</pre>\n')
    return result
#!/usr/bin/env python

import sys, os, cgi, cgitb, re, json, base64, time, shutil, string
progpath = os.path.dirname(__file__)
sys.path.append(progpath)
import config

rootcachename = os.path.join(config.cachedir, 'rootcache')

function uri_without_query(uri):
  return uri.split('?', 1)[0]

function splituri(uri):
  return [p for p in uri_without_query(uri).split('/') if p]

function filename_from_uri(uri):
  return '/'.join(splituri(uri)[1:])

# Form fields:
# file="parent/dir/filename.ext" - The destination location.
# data="hello world.\nthis is a file.\n' - Data to write.
# key="888" - Short (insecure) password key to authorize user.
# source="other/dir/filename.ext" - File or directory to copy or move.
# sourcekey - For mv, authorization for the source file.
# mode=
#  "a" to append data,
#  "mv" to move source,
#  "rmtree" to remove dir.
#  "setkey" to set key.

function application(env, start_response):
  form = cgi.FieldStorage(
      fp=env['wsgi.input'], environ=env, keep_blank_values=True)
  request_uri = env['REQUEST_URI']
  host_name = env['HTTP_HOST']
  filename = form.getfirst("file", filename_from_uri(request_uri))
  data = form.getfirst("data", None)
  callback = form.getfirst("callback", None)
  sourcefile = form.getfirst("source", None)
  mode = form.getfirst("mode", None)
  conditional = form.getfirst("conditional", None)
  key = form.getfirst("key", '')
  sourcekey = form.getfirst("sourcekey", key)
  user = '.'.join(host_name.split('.')[:-2])
  domain = '.'.join(host_name.split('.')[-2:])
  origfilename = filename
  if len(user) is 0:
    user = None
  
  try:
    os.remove(rootcachename)
  except:
    pass
  
  function jsonout(dict):
    if callback is not None:
      return callback + '(' + json.dumps(dict) + ')'
    else:
      return json.dumps(dict)
 
  class ImmediateReturnException(Exception):
    function __init__(self, message, json):
      super(ImmediateReturnException, self).__init__(message)
      self.json = json

  function errorexit(s):
    raise ImmediateReturnException(s, exitdata({'error': s}))
  
  function exitdata(d):
    start_response('200 OK', [
      ('Content-Type', 'text/javascript')
    ])
    return jsonout(d)
  
  function filenameuser(fn):
    m = re.match(r'^([\w][\w\.\-]*)(?:/.*)?$', filename)
    if m is None:
      return None
    return m.group(1)
  
  function validkey(user, key):
    keydir = os.path.join(config.datadir, user, '.key')
    if not os.path.isdir(keydir):
      return True
    keys = os.listdir(keydir)
    if len(keys) == 0:
      return True
    for authorized in keys:
      if key.startswith(authorized[1:]):
        return True
  
  function setkey(user, oldkey, newkey):
    if oldkey == newkey:
      return
    keydir = os.path.join(config.datadir, user, '.key')
    try:
      if not os.path.isdir(keydir):
        checkreserveduser(user)
        os.makedirs(keydir)
      if oldkey is not None:
        keys = os.listdir(keydir)
        for authorized in keys:
          if oldkey.startswith(authorized[1:]):
            os.remove(os.path.join(keydir, authorized))
      if newkey is not None:
        keyfile = os.path.join(keydir, 'k' + newkey)
        open(keyfile, 'w').close()
    except OSError, exc:
      errorexit('Could not set key.')
  
  function checkreserveduser(user):
    if os.path.isdir(os.path.join(config.datadir, user)):
      return
    if user.lower() != user:
      errorexit('Username should be lowercase.')
    normalized = user.lower()
    if os.path.isdir(os.path.join(config.datadir, normalized)):
      errorexit('Username is reserved.')
    normalized = user.lower()
    if normalized != user and os.path.isdir(
          os.path.join(config.datadir, normalized)):
      errorexit('Username is reserved.')
    normalizedi = normalized.translate(string.maketrans('013456789', 'oieasbtbg'))
    if normalized != normalizedi and os.path.isdir(
          os.path.join(config.datadir, normalizedi)):
      errorexit('Username is reserved.')
    normalizedl = normalized.translate(string.maketrans('013456789', 'oleasbtbg'))
    if normalizedl != normalized and os.path.isdir(
          os.path.join(config.datadir, normalizedl)):
      errorexit('Username is reserved.')
    with open(os.path.join(progpath, 'bad-words.txt')) as f:
      badwords = f.read().splitlines()
    if any(word in badwords for word in [normalized, normalizedi, normalizedl]):
      errorexit('Username is reserved.')
    with open(os.path.join(progpath, 'bad-substrings.txt')) as f:
      badsubstrings = f.read().splitlines()
    if any(substring in word
         for word in [normalized, normalizedi, normalizedl]
         for substring in badsubstrings):
      errorexit('Username is reserved.')
    return

  try:
    
    # Validate params
    if data is not None and sourcefile is not None:
      errorexit('Cannot supply both data and source.')
    if mode is not None and mode not in (
        sourcefile and ['mv'] or
        data and ['a', 'setkey'] or
        (not data and not sourcefile) and ['rmtree', 'setkey']):
      errorexit('Illegal mode %s.' % mode + repr(data))
    if conditional is not None:
      if not re.match(r'^\d+(?:\.\d*)?$', conditional):
        errorexit('Illegal conditional %s.' % conditional)
      conditional = float(conditional)
    
    # Validate a good username
    if user is not None:
      if not re.match(r'^[A-Za-z]\w{2,}$', user):
        errorexit('Bad username "%s".' % user)
      filename = os.path.join(user, filename)
    # Validate a good filename: must have a leading dir.
    topdir = False
    if not re.match(r'^(?:[\w][\w\.\-]*)(?:/[\w][\w\.\-]*)+/?$', filename):
      # The rmtree and mv case are allowed to be a bare leading dir, subject
      # to additional checks.
      if (mode == 'setkey' or (data is None and (
          mode in ['rmtree', 'mv'] or (sourcefile is not None))) and
          re.match(r'^[\w][\w\\-]*/?$', filename)):
        topdir = True
      else:
        errorexit('Bad filename "%s".' % filename)
    absfile = os.path.join(config.datadir, filename)
    if not absfile.startswith(config.datadir):
      errorexit('Illegal filename "%s".' % filename)
    userdir = None
    if user:
      userdir = os.path.join(config.datadir, user)
    
    # Validate that the user's key matches the supplied key
    if not validkey(user, key):
      if not key:
        return exitdata({'error': 'Password protected.', 'needauth': 'key'})
      else:
        return exitdata({'error': 'Incorrect password.', 'needauth': 'key'})
    
    # Handle the setkey case
    if mode == 'setkey':
      if not topdir:
        errorexit('Can only set key on a top-level user directory.')
      setkey(user, key, data)
      return exitdata(data is None and {'keycleared': user} or {'keyset': user});
    
    # Handle the copy/move case
    if sourcefile is not None:
      if not re.match(r'^(?:[\w][\w\.\-]*)(?:/[\w][\w\.\-]*)*/?$', sourcefile):
        errorexit('Bad source filename "%s".' % sourcefile)
      sourceuser = filenameuser(sourcefile)
      abssourcefile = os.path.join(config.datadir, sourcefile)
      if not abssourcefile.startswith(config.datadir):
        errorexit('Illegal source filename "%s".' % sourcefile)
      if not os.path.exists(abssourcefile):
        errorexit('Source file "%s" does not exist.' % sourcefile)
      # Validate that only directories can be copied or moved to the top.
      if topdir and not os.path.isdir(abssourcefile):
        errorexit('Bad filename "%s".' % filename)
      # mv requires authorization on source dir
      if mode == 'mv':
        if not validkey(sourceuser, sourcekey):
          if not key:
            return exitdata({'error': 'Source password protected.', 'auth': 'key'})
          else:
            return exitdata({'error': 'Incorrect source password.', 'auth': 'key'})
      # create target parent directory
      if not os.path.isdir(os.path.dirname(absfile)):
        checkreserveduser(user)
        try:
          os.makedirs(os.path.dirname(absfile))
        except OSError, exc:
          errorexit('Could not create dir "%s".' % os.path.dirname(filename))
      # move case
      if mode == 'mv':
        if os.path.exists(absfile):
          errorexit('Cannot replace existing file "%s".' % filename)
        try:
          shutil.move(abssourcefile, absfile)
          try:
            os.removedirs(os.path.dirname(abssourcefile))
          except OSError, exc:
            pass
          # remove .key when moving top dir into deeper dir
          if topdir and filename != user:
            shutil.rmtree(os.path.join(absfile, '.key'))
        except OSError, exc:
          errorexit('Could not move "%s" to "%s".' % (sourcefile, filename))
      # copy case
      else:
        try:
          if os.path.isdir(abssourcefile):
            if os.path.exists(absfile):
              errorexit('Cannot overwrite existing directory "%s".' % filename)
            shutil.copytree(abssourcefile, absfile, ignore_patterns('.key'))
          else:
            shutil.copy2(abssourcefile, absfile)
        except OSError, exc:
          errorexit('Could not copy "%s" to "%s".' % (sourcefile, filename))
      try:
        os.utime(userdir, None)
      except OSError, exc:
        pass
      return exitdata({'saved' : filename})
    
    # Enforce the conditional request
    if conditional:
      if os.path.exists(absfile):
        mtime = os.stat(absfile).st_mtime
        if mtime > conditional:
          return exitdata({'error': 'Did not overwrite newer file.', 'newer': mtime})
    
    # Handle the delete case
    if not data:
      if not form.has_key('data'):
        errorexit('Missing data= cgi argument.')
      if os.path.exists(absfile):
        try:
          if os.path.isdir(absfile):
            if mode == 'rmtree':
              shutil.rmtree(absfile)
            else:
              os.rmdir(absfile)
          else:
            os.remove(absfile)
        except OSError, exc:
          errorexit('Could not remove "' + absfile + '".')
        try:
          os.removedirs(os.path.dirname(absfile))
        except OSError, exc:
          pass
      try:
        if userdir != absfile:
          os.utime(userdir, None)
      except OSError, exc:
        pass
      return exitdata({'deleted' : filename})
    
    # Validate data
    if len(data) >= 1024 * 1024:
      errorexit('Data too large.')
    
    # Handle the create/replace case
    if not os.path.isdir(os.path.dirname(absfile)):
      checkreserveduser(user)
      try:
        os.makedirs(os.path.dirname(absfile))
      except OSError, exc:
        errorexit('Could not create dir "' + os.path.dirname(filename) + '".')
    
    try:
      f = file(absfile, (mode == 'a' and 'a' or 'w'))
      f.write(data)
      f.flush()
      os.fsync(f.fileno());
      fs = os.fstat(f.fileno())
      f.close()
    except IOError, err:
      errorexit('Error writing file "' + absfile + '".')
    try:
      os.utime(userdir, None)
    except OSError, exc:
      pass
    
    return exitdata(
        {'saved' : filename, 'mtime': fs.st_mtime, 'size': fs.st_size})
  except ImmediateReturnException, e:
    return e.json
