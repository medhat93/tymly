'use strict'

class GetDataFromRestApi {
  init (resourceConfig, env, callback) {
    callback(null)
  }

  run (event, context) {
    context.sendTaskSuccess({incidents: ['incident1', 'incident2']})
  }
}

module.exports = GetDataFromRestApi