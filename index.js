const GoogleAuth = new (require('google-auth-library'))()

module.exports = function getAuthenticator({
  clientId,
  tokenRetriever = getToken,
  test = {},
}) {
  const authClient = new GoogleAuth.OAuth2(clientId)

  return function *authenticate(next) {
    const token = tokenRetriever(this.request)

    this.assert(token, 401, 'authorization token not found')

    if (test != undefined && test.token === token) {
      this.state.user = test.user
      yield* next
      return
    }

    try {
      this.state.user = yield verifyToken(authClient, token)
    } catch(e) {
      this.throw(401, e)
    }

    yield* next
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
