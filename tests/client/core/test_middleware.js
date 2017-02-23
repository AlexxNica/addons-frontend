import { prefixMiddleWare, trailingSlashesMiddleware } from 'core/middleware';


describe('Prefix Middleware', () => {
  let fakeRes;
  let fakeNext;
  let fakeConfig;

  beforeEach(() => {
    fakeNext = sinon.stub();
    fakeRes = {
      locals: {},
      redirect: sinon.stub(),
      set: sinon.stub(),
      status: () => ({ end: sinon.stub() }),
    };
    fakeConfig = new Map();
    fakeConfig.set('validClientApplications', ['firefox', 'android']);
    fakeConfig.set('validUrlExceptions', ['developers', 'validprefix']);
  });

  it('should call res.redirect if changing the case', () => {
    const fakeReq = {
      originalUrl: '/en-us/firefox',
      headers: {},
    };
    prefixMiddleWare(fakeReq, fakeRes, fakeNext, { _config: fakeConfig });
    assert.deepEqual(fakeRes.redirect.firstCall.args, [302, '/en-US/firefox']);
    assert.notOk(fakeNext.called);
  });

  it('should call res.redirect if handed a locale insted of a lang', () => {
    const fakeReq = {
      originalUrl: '/en_US/firefox',
      headers: {},
    };
    prefixMiddleWare(fakeReq, fakeRes, fakeNext, { _config: fakeConfig });
    assert.deepEqual(fakeRes.redirect.firstCall.args, [302, '/en-US/firefox']);
    assert.notOk(fakeNext.called);
  });

  it('should add an application when missing', () => {
    const fakeReq = {
      originalUrl: '/en-US/whatever/',
      headers: {},
    };
    prefixMiddleWare(fakeReq, fakeRes, fakeNext, { _config: fakeConfig });
    assert.deepEqual(fakeRes.redirect.firstCall.args, [302, '/en-US/firefox/whatever/']);
  });

  it('should prepend a lang when missing but leave a valid app intact', () => {
    const fakeReq = {
      originalUrl: '/firefox/whatever',
      headers: {},
    };
    prefixMiddleWare(fakeReq, fakeRes, fakeNext, { _config: fakeConfig });
    assert.deepEqual(fakeRes.redirect.firstCall.args, [302, '/en-US/firefox/whatever']);
    assert.deepEqual(fakeRes.set.firstCall.args, ['vary', []]);
  });

  it('should prepend lang when missing but preserve valid urlException', () => {
    const fakeReq = {
      originalUrl: '/validprefix/whatever',
      headers: {},
    };
    prefixMiddleWare(fakeReq, fakeRes, fakeNext, { _config: fakeConfig });
    assert.deepEqual(fakeRes.redirect.firstCall.args, [302, '/en-US/validprefix/whatever']);
    assert.deepEqual(fakeRes.set.firstCall.args, ['vary', []]);
  });

  it('should render a 404 when a URL exception is found', () => {
    const fakeReq = {
      originalUrl: '/en-US/developers/theme/submit',
      headers: {},
    };
    const resSpy = sinon.spy(fakeRes, 'status');
    prefixMiddleWare(fakeReq, fakeRes, fakeNext, { _config: fakeConfig });
    assert.deepEqual(resSpy.firstCall.args, [404]);
  });

  it('should set lang when invalid but preserve valid urlException', () => {
    const fakeReq = {
      originalUrl: '/en-USA/developers/',
      headers: {},
    };
    prefixMiddleWare(fakeReq, fakeRes, fakeNext, { _config: fakeConfig });
    assert.deepEqual(fakeRes.redirect.firstCall.args, [302, '/en-US/developers/']);
    assert.deepEqual(fakeRes.set.firstCall.args, ['vary', []]);
  });

  it('should render a 404 when a URL exception is found at the root', () => {
    const fakeReq = {
      originalUrl: '/en-US/developers/',
      headers: {},
    };
    const resSpy = sinon.spy(fakeRes, 'status');
    prefixMiddleWare(fakeReq, fakeRes, fakeNext, { _config: fakeConfig });
    assert.deepEqual(resSpy.firstCall.args, [404]);
  });

  it('should fallback to and vary on accept-language headers', () => {
    const fakeReq = {
      originalUrl: '/firefox/whatever',
      headers: {
        'accept-language': 'pt-br;q=0.5,en-us;q=0.3,en;q=0.2',
      },
    };
    prefixMiddleWare(fakeReq, fakeRes, fakeNext, { _config: fakeConfig });
    assert.deepEqual(fakeRes.redirect.firstCall.args, [302, '/pt-BR/firefox/whatever']);
    assert.sameMembers(fakeRes.set.firstCall.args[1], ['accept-language']);
  });

  it('should map aliased langs', () => {
    const fakeReq = {
      originalUrl: '/pt/firefox/whatever',
      headers: {},
    };
    prefixMiddleWare(fakeReq, fakeRes, fakeNext, { _config: fakeConfig });
    assert.deepEqual(fakeRes.redirect.firstCall.args, [302, '/pt-PT/firefox/whatever']);
  });

  it('should vary on accept-language and user-agent', () => {
    const fakeReq = {
      originalUrl: '/whatever',
      headers: {
        'accept-language': 'pt-br;q=0.5,en-us;q=0.3,en;q=0.2',
      },
    };
    prefixMiddleWare(fakeReq, fakeRes, fakeNext, { _config: fakeConfig });
    assert.deepEqual(fakeRes.redirect.firstCall.args, [302, '/pt-BR/firefox/whatever']);
    assert.sameMembers(fakeRes.set.firstCall.args[1], ['accept-language', 'user-agent']);
  });

  it('should find the app based on ua string', () => {
    const fakeReq = {
      originalUrl: '/en-US/whatever',
      headers: {
        'user-agent': 'Mozilla/5.0 (Android; Mobile; rv:40.0) Gecko/40.0 Firefox/40.0',
      },
    };
    prefixMiddleWare(fakeReq, fakeRes, fakeNext, { _config: fakeConfig });
    assert.deepEqual(fakeRes.redirect.firstCall.args, [302, '/en-US/android/whatever']);
    assert.sameMembers(fakeRes.set.firstCall.args[1], ['user-agent']);
  });

  it('should populate res.locals for a valid request', () => {
    const fakeReq = {
      originalUrl: '/en-US/firefox/',
      headers: {},
    };
    prefixMiddleWare(fakeReq, fakeRes, fakeNext, { _config: fakeConfig });
    assert.equal(fakeRes.locals.lang, 'en-US');
    assert.equal(fakeRes.locals.clientApp, 'firefox');
    assert.notOk(fakeRes.redirect.called);
  });

  it('should not populate res.locals for a redirection', () => {
    const fakeReq = {
      originalUrl: '/foo/bar',
      headers: {},
    };
    prefixMiddleWare(fakeReq, fakeRes, fakeNext, { _config: fakeConfig });
    assert.equal(fakeRes.locals.lang, undefined);
    assert.equal(fakeRes.locals.clientApp, undefined);
    assert.ok(fakeRes.redirect.called);
  });

  it('should not mangle a query string for a redirect', () => {
    const fakeReq = {
      originalUrl: '/foo/bar?test=1&bar=2',
      headers: {},
    };
    prefixMiddleWare(fakeReq, fakeRes, fakeNext, { _config: fakeConfig });
    assert.deepEqual(fakeRes.redirect.firstCall.args, [302, '/en-US/firefox/foo/bar?test=1&bar=2']);
  });
});

describe('Trailing Slashes Middleware', () => {
  let fakeRes;
  let fakeNext;
  let fakeConfig;

  beforeEach(() => {
    fakeNext = sinon.stub();
    fakeRes = {
      locals: {},
      redirect: sinon.stub(),
      set: sinon.stub(),
    };
    fakeConfig = new Map();
    fakeConfig.set('enableTrailingSlashesMiddleware', true);
  });

  it('should call next and do nothing with a valid, trailing slash URL', () => {
    const fakeReq = {
      originalUrl: '/foo/bar/',
      headers: {},
    };
    trailingSlashesMiddleware(
      fakeReq, fakeRes, fakeNext, { _config: fakeConfig });
    assert.ok(fakeNext.called);
  });

  it('should add trailing slashes to a URL if one is not found', () => {
    const fakeReq = {
      originalUrl: '/foo/bar',
      headers: {},
    };
    trailingSlashesMiddleware(
      fakeReq, fakeRes, fakeNext, { _config: fakeConfig });
    assert.deepEqual(fakeRes.redirect.firstCall.args, [301, '/foo/bar/']);
    assert.notOk(fakeNext.called);
  });

  it('should include query params in the redirect', () => {
    const fakeReq = {
      originalUrl: '/foo/search?q=foo&category=bar',
      headers: {},
    };
    trailingSlashesMiddleware(
      fakeReq, fakeRes, fakeNext, { _config: fakeConfig });
    assert.deepEqual(fakeRes.redirect.firstCall.args,
      [301, '/foo/search/?q=foo&category=bar']);
    assert.notOk(fakeNext.called);
  });

  it('should handle several ? in URL (though that should never happen)', () => {
    const fakeReq = {
      originalUrl: '/foo/search?q=foo&category=bar?test=bad',
      headers: {},
    };
    trailingSlashesMiddleware(
      fakeReq, fakeRes, fakeNext, { _config: fakeConfig });
    assert.deepEqual(fakeRes.redirect.firstCall.args,
      [301, '/foo/search/?q=foo&category=bar?test=bad']);
    assert.notOk(fakeNext.called);
  });
});
