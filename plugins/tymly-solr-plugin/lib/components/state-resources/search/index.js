'use strict'

const _ = require('lodash')

// query: 'fire',
// domain: 'search',
// orderBy: 'relevance',
// offset: 0,
// limit: 10,
// lat: 52.4802841999,
// long: -1.87608150675,
// categoryRestriction: []
// showActiveEventsOnly: false

class Search {
  init (resourceConfig, env, callback) {
    this.services = env.bootedServices
    callback(null)
  }

  run (event, context) {
    const searchDocs = this.services.solr.searchDocs || []
    const filters = this.processFilters(event)
    const searchResults = {
      input: filters
    }
    const matchingDocs = this.filterDocs(searchDocs, filters)
    searchResults.totalHits = matchingDocs.length
    // if (filters.orderBy) this.orderDocsByRelevance(matchingDocs)
    const facets = {}
    matchingDocs.map(doc => {
      if (!facets.hasOwnProperty(doc.category)) {
        facets[doc.category] = 1
      } else {
        facets[doc.category]++
      }
    })
    searchResults.categoryCounts = facets
    searchResults.results = matchingDocs.slice(filters.offset, (filters.offset + filters.limit))
    context.sendTaskSuccess({searchResults})
  }

  filterDocs (docs, filters) {
    const matchingDocs = []
    Object.keys(docs).map(key => {
      const candidate = docs[key]
      if (
        this.domainMatch(filters.domain, candidate) &&
        this.queryMatch(filters.query, candidate) &&
        this.categoryMatch(filters.categoryRestriction, candidate) &&
        this.activeEventMatch(filters.showActiveEventsOnly, candidate)) {
        matchingDocs.push(candidate)
      }
    })
    return matchingDocs
  }

  queryMatch (query, doc) {
    if (_.isUndefined(query)) {
      // No query restriction so match
      return true
    } else {
      // select * tymly.solr_data ...
      // let searchText = `${doc.title} ${doc.description}`
      // if (_.isString(doc.additionalTerms)) {
      //   searchText = searchText + ' ' + doc.additionalTerms
      // }
      // searchText = searchText.toLowerCase()
      // return searchText.includes(query.toLowerCase())
      return ''
    }
  }

  categoryMatch (categoryRestriction, doc) {
    if (categoryRestriction.length === 0) {
      return true
    } else {
      return categoryRestriction.indexOf(doc.category) !== -1
    }
  }

  domainMatch (domain, doc) {
    if (!domain) {
      return true
    } else {
      return domain === doc.domain
    }
  }

  activeEventMatch (showActiveEventsOnly, doc) {
    if (!showActiveEventsOnly) {
      return true
    } else {
      return doc.activeEvent
    }
  }

  processFilters (event) {
    const searchDefaults = {
      orderBy: 'relevance',
      offset: 0,
      limit: 10,
      categoryRestriction: [],
      showActiveEventsOnly: false
    }
    const filters = {}
    if (_.isString(event.domain)) {
      filters.domain = event.domain
    }

    if (_.isString(event.query) && event.query.trim() !== '') {
      filters.query = event.query
    }

    if (_.isString(event.orderBy)) {
      filters.orderBy = event.orderBy
    } else {
      filters.orderBy = searchDefaults.orderBy
    }

    if (_.isInteger(event.offset)) {
      filters.offset = event.offset
    } else {
      filters.offset = searchDefaults.offset
    }

    if (_.isInteger(event.offset)) {
      filters.limit = event.limit
    } else {
      filters.limit = searchDefaults.limit
    }

    if (_.isNumber(event.lat) && _.isNumber(event.long)) {
      filters.lat = event.lat
      filters.long = event.long
    }

    if (_.isArray(event.categoryRestriction)) {
      filters.categoryRestriction = event.categoryRestriction
    } else {
      filters.categoryRestriction = searchDefaults.categoryRestriction
    }

    if (_.isBoolean(event.showActiveEventsOnly)) {
      filters.showActiveEventsOnly = event.showActiveEventsOnly
    } else {
      filters.showActiveEventsOnly = searchDefaults.showActiveEventsOnly
    }

    return filters
  }
}

module.exports = Search
