import Koa from 'koa'
import mount from 'koa-mount'
import open from 'open'
import http from 'http'
import googleAuth from './index.js'
import test from 'node:test'
import { strict as assert } from 'assert'

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
const baseUrl = `http://localhost:${serverPort}`
const authenticationHeaders = new Headers({
  Authorization: testToken,
})

test('test token and user', async () => {
  const server = getTestServer(baseConfig)

  await startTestServer(server)

  const [
    resultWithAuthentication,
    resultWithoutAuthentication
  ] = await Promise.all([
    fetch(baseUrl, {
      headers: authenticationHeaders
    }),
    fetch(baseUrl)
  ])

  assert.equal(resultWithAuthentication.status, 200)
  assert.deepStrictEqual(await resultWithAuthentication.json(), testUser)
  assert.equal(resultWithoutAuthentication.status, 401)

  await stopTestServer(server)
})

test('custom token retriever', async () => {
  const server = getTestServer(Object.assign({}, baseConfig, {
    tokenRetriever: request => request.query.token,
  }))

  await startTestServer(server)

  const [
    resultWithAuthentication,
    resultWithoutAuthentication
  ] = await Promise.all([
    fetch(`${baseUrl}?token=${testToken}`),
    fetch(baseUrl)
  ])

  assert.equal(resultWithAuthentication.status, 200)
  assert.deepStrictEqual(await resultWithAuthentication.json(), testUser)
  assert.equal(resultWithoutAuthentication.status, 401)

  await stopTestServer(server)
})

test('invalid token', async () => {
  const server = getTestServer(Object.assign({}, baseConfig, {
    test: null,
  }))

  await startTestServer(server)

  const { status } = await fetch(baseUrl, {
    headers: authenticationHeaders
  })

  assert.equal(status, 401)

  await stopTestServer(server)
})

test('valid token', async t => {
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

            fetch('${baseUrl}', {
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

  const pendingSuccess = /** @type {Promise<void>} */(new Promise(resolve => {
    app.use(ctx => {
      ctx.body = 'Success! You may close this window/tab.'
      resolve()
    })
  }))

  const server = http.createServer(app.callback())

  await startTestServer(server)
  await open(baseUrl + testPagePath, {
    wait: false
  })
  await pendingSuccess
  await stopTestServer(server)
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
