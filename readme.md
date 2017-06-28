Koa middleware for verifying authenticating based on [google sign-in for websites](https://developers.google.com/identity/sign-in/web/) ID tokens.

### Install

```bash
npm install --save koa-google-sign-in
```

### Use

Tokens are verified using your Google sign in client ID. The resulting Google user object is attached to `ctx.state.user`.

```node
const Koa = require('koa')
const googleSignInAuth = require('koa-google-sign-in')

const app = new Koa()
app.use(googleSignInAuth({
  clientId: process.env.GOOGLE_SIGN_IN_CLIENT_ID,
  tokenRetriever: request => request.query.token,
  test: {
  	token: 'test',
  	user: {
  	  email: 'test@something.whatever'
  	}
  }
}))

app.use(function respond(ctx) {
  ctx.body = `Signed in as ${ctx.state.user.email}`
})

app.listen(process.env.PORT)
```

`clientId` is required. It comes from the Google API console.

`tokenRetriever` is optional. If it's not provided, the value of the `Authorization` header will be used.

The `test` object is optional. It can be used to configure a test token and user object. When the test token is provided, the test user will be returned. By default, there is no test token.
