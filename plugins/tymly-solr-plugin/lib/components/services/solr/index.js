'use strict'

const debug = require('debug')('tymly-solr-plugin')
const _ = require('lodash')
const process = require('process')
const boom = require('boom')
const request = require('request')
const defaultSolrSchemaFields = require('./solr-schema-fields.json')

class SolrService {
  boot (options, callback) {
    this.solrConnection = SolrService._solrConnection(options.config)
    this.solrUrl = this.solrConnection ? `http://${this.solrConnection.host}:${this.solrConnection.port}${this.solrConnection.path}` : null
    options.messages.info(this.solrUrl ? `Using Solr... (${this.solrUrl})` : 'No Solr URL configured')

    if (!options.blueprintComponents.hasOwnProperty('searchDocs')) {
      options.messages.info('No search-docs configuration found')
      this.solrSchemaFields = []
      this.createViewSQL = null
      callback(null)
    } else {
      this.searchDocs = options.blueprintComponents.searchDocs
      const storageClient = options.bootedServices.storage.client
      if (!storageClient) {
        callback(boom.notFound('failed to boot solr service: no database client available'))
      } else {
        if (options.config.solrSchemaFields === undefined) {
          this.solrSchemaFields = SolrService.constructSolrSchemaFieldsArray(defaultSolrSchemaFields)
        } else {
          this.solrSchemaFields = SolrService.constructSolrSchemaFieldsArray(options.config.solrSchemaFields)
        }
        debug('solrSchemaFields', this.solrSchemaFields)

        this.createViewSQL = this.buildCreateViewStatement(
          SolrService.constructModelsArray(options.blueprintComponents.models),
          SolrService.constructSearchDocsArray(this.searchDocs))
        if (this.createViewSQL) {
          storageClient.query(this.createViewSQL, [], (err) => {
            debug('Database view created with SQL: ', this.createViewSQL)
            callback(err)
          })
        } else {
          callback(boom.notFound('failed to construct create view SQL'))
        }
      }
    }
  }

  static _solrConnection (config) {
    const solrConfig = config.solr || {}

    const host = solrConfig.host || process.env.SOLR_HOST
    const port = solrConfig.port || process.env.SOLR_PORT
    const path = solrConfig.path || process.env.SOLR_PATH

    if (host && port && path) {
      return {
        host: host,
        port: port,
        path: path
      }
    }

    debug('No Solr config found in config.solr or in environment variable')
    return null
  } // _connectionUrl

  static constructModelsArray (models) {
    let modelsArray = []
    for (const modelName in models) {
      if (models.hasOwnProperty(modelName)) {
        modelsArray.push(models[modelName])
      }
    }
    return modelsArray
  }

  static constructSearchDocsArray (searchDocs) {
    let searchDocsArray = []
    for (const searchDocName in searchDocs) {
      if (searchDocs.hasOwnProperty(searchDocName)) {
        searchDocsArray.push(searchDocs[searchDocName])
      }
    }
    return searchDocsArray
  }

  static constructSolrSchemaFieldsArray (fields) {
    const solrSchemaFieldsArray = []
    for (const field of fields) {
      solrSchemaFieldsArray.push([field, field])
    }
    return solrSchemaFieldsArray
  }

  buildSelectStatement (model, searchDoc) {
    const columns = this.solrSchemaFields.map(
      solrDefault => {
        const solrFieldName = solrDefault[0]
        const defaultValue = solrDefault[1]
        let mappedValue = searchDoc.attributeMapping[solrFieldName]
        if (!_.isUndefined(mappedValue)) {
          if (mappedValue[0] === '@') {
            mappedValue = _.snakeCase(mappedValue.substring(1))
          }
        }
        return `${mappedValue || defaultValue} AS ${_.snakeCase(solrFieldName)}`
      }
    )

    return `SELECT ${columns.join(', ')} FROM ${_.snakeCase(model.namespace)}.${_.snakeCase(model.title)}`
  }

  buildCreateViewStatement (models, searchDocs) {
    let selects = []
    for (let model of models) {
      const modelId = `${_.camelCase(model.namespace)}_${model.id}`
      debug(` - model ${modelId}`)
      let currentSearchDoc = null
      for (let searchDoc of searchDocs) {
        const searchDocId = `${_.camelCase(searchDoc.namespace)}_${searchDoc.id}`
        debug('   - searchDoc', searchDocId)
        if (searchDocId === modelId) {
          currentSearchDoc = searchDoc
          debug(`     > Corresponding searchDoc '${searchDocId}' found for model '${modelId}'!`)
          break
        }
      }
      if (currentSearchDoc !== null) {
        selects.push(this.buildSelectStatement(model, currentSearchDoc))
      }
    }

    if (selects.length !== 0) {
      return `CREATE OR REPLACE VIEW tymly.solr_data AS \n${selects.join('\nUNION\n')};`
    } else {
      return null
    }
  }

  executeSolrFullReindex (core, cb) {
    this._executeReindex('full-import', core, cb)
  }

  executeSolrDeltaReindex (core, cb) {
    this._executeReindex('delta-import', core, cb)
  }

  _executeReindex (type, core, cb) {
    if (!this.solrUrl) {
      return cb(null)
    }

    request.post(
      buildDataImportPost(this.solrUrl, type, core),
      (err, response, body) => (err) ? cb(err) : cb(null, JSON.parse(body))
    )
  } // _executeReindex
}

function buildDataImportPost (solrUrl, command, core) {
  const uniqueIdentifier = new Date().getTime()
  let clean = true
  if (command === 'delta-import') {
    clean = false
  }
  let url = solrUrl
  if (solrUrl[solrUrl.length - 1] !== '/') {
    url += '/'
  }
  return {
    url: `${url}${core}/dataimport?_=${uniqueIdentifier}&indent=off&wt=json`,
    form: {
      'clean': clean,
      'command': command,
      'commit': true,
      'core': core,
      'name': 'dataimport',
      'optimize': false,
      'verbose': false
    }
  }
} // buildDataImportPost

module.exports = {
  serviceClass: SolrService,
  bootAfter: ['storage']
}
