const test = require('tape')
const Koa = require('koa')
const mount = require('koa-mount')
const open = require('opn')
const http = require('http')
const googleAuth = require('./index.js')
const request = require('request-promise')
const Promise = require('bluebird')

const testClientId = '984514058637-n4064avq1u977cn1cpjrk0p0baiohq9e.apps.googleusercontent.com'
const serverPort = 3456
const testToken = 'test'
const testUser = { email: 'email@something.whatever' }
const baseConfig = {
  clientId: testClientId,
  test: {
    token: testToken,
    user: testUser,
  },
}
const baseRequest = {
  uri: `http://localhost:${serverPort}`,
  headers: {
    Authorization: testToken,
  },
  resolveWithFullResponse: true,
  simple: false,  // reject promise only for technical reasons
  json: true,
}

test('test token and user', t => {
  const server = getTestServer(baseConfig)

  startTestServer(server)
  .then(() => Promise.join(
    request(baseRequest),
    request(Object.assign({}, baseRequest, { headers: {} }))
  ))
  .spread((successful, failure) => {
    t.equal(successful.statusCode, 200)
    t.deepLooseEqual(successful.body, testUser)

    t.equal(failure.statusCode, 401)
  })
  .finally(() => stopTestServer(server))
  .finally(t.end)
})

test('custom token retriever', t => {
  const server = getTestServer(Object.assign({}, baseConfig, {
    tokenRetriever: request => request.query.token,
  }))

  startTestServer(server)
  .then(() => Promise.join(
    request(Object.assign({}, baseRequest, {
      qs: {
        token: testToken,
      },
    })),
    request(baseRequest)
  ))
  .spread((successful, failure) => {
    t.equal(successful.statusCode, 200)
    t.deepLooseEqual(successful.body, testUser)

    t.equal(failure.statusCode, 401)
  })
  .finally(() => stopTestServer(server))
  .finally(t.end)
})

test('invalid token', t => {
  const server = getTestServer(Object.assign({}, baseConfig, {
    test: null,
  }))

  startTestServer(server)
  .then(() => request(baseRequest))
  .then(({ statusCode }) => t.equal(statusCode, 401))
  .finally(() => stopTestServer(server))
  .finally(t.end)
})

test('valid token', t => {
  const app = new Koa()
  const testPagePath = '/testPage'

  app.use(mount(testPagePath, ctx => {
    ctx.body = `
    <html lang="en">
      <head>
        <meta name="google-signin-scope" content="profile email">
        <meta name="google-signin-client_id" content="${testClientId}">
        <script src="https://apis.google.com/js/platform.js" async defer></script>
      </head>
      <body>
        <div class="g-signin2" data-onsuccess="onSignIn" data-theme="dark"></div>
        <script>
          function onSignIn(googleUser) {
            const idToken = googleUser.getAuthResponse().id_token

            fetch('${baseRequest.uri}', {
              headers: {
                Authorization: idToken
              },
              mode: 'cors'
            })
            .then(response => response.text())
            .then(text => document.body.innerHTML = text)
          }
        </script>
      </body>
    </html>
    `
  }))
  app.use(googleAuth(baseConfig))
  app.use(ctx => { ctx.body = 'Success! Quit this browser to continue tests.' })

  const server = http.createServer(app.callback())

  startTestServer(server)
  .then(() => open(baseRequest.uri + testPagePath, {
    app: ['google chrome', '--incognito']
  }))
  .finally(() => stopTestServer(server))
  .finally(t.end)
})

function getTestServer(config) {
  const app = new Koa()

  app.use(googleAuth(config))
  app.use(ctx => { ctx.body = ctx.state.user })

  return http.createServer(app.callback())
}

function startTestServer(server) {
  return new Promise(resolve => server.listen(serverPort, resolve))
}

function stopTestServer(server) {
  return new Promise(resolve => server.close(resolve))
}