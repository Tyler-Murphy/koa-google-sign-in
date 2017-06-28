const GoogleAuth = new (require('google-auth-library'))()

module.exports = function getAuthenticator({
  clientId,
  tokenRetriever = getToken,
  test = {},
}) {
  const authClient = new GoogleAuth.OAuth2(clientId)

  return async function authenticate(ctx, next) {
    const token = tokenRetriever(ctx.request)

    ctx.assert(token, 401, 'authorization token not found')

    if (test != undefined && test.token === token) {
      ctx.state.user = test.user
      await next()
      return
    }

    try {
      ctx.state.user = await verifyToken(authClient, token)
    } catch(e) {
      ctx.throw(401, e)
    }

    await next()
  }
}

function getToken(request) {
  return request.headers.authorization
}

function verifyToken(authClient, token) {
  return new Promise((resolve, reject) => {
    authClient.verifyIdToken(token, null, (error, result) => {
      if (error) {
        reject(error)
      } else {
        resolve(result.getPayload())
      }
    })
  })
}
