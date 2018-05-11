/* eslint-env mocha */

const expect = require('chai').expect
const tymly = require('tymly')
const path = require('path')
const process = require('process')

const SEND_SMS_STATE_MACHINE_NAME = 'test_sendWelcomeSms'

describe('Send SMS tests', function () {
  this.timeout(process.env.TIMEOUT || 5000)

  let tymlyService, statebox

  it('boot tymly', done => {
    tymly.boot(
      {
        pluginPaths: [
          path.resolve(__dirname, './../lib')
        ],
        blueprintPaths: [
          path.resolve(__dirname, './fixtures/blueprints/welcome-blueprint')
        ],
        config: {}
      },
      (err, tymlyServices) => {
        expect(err).to.eql(null)
        tymlyService = tymlyServices.tymly
        statebox = tymlyServices.statebox
        done()
      }
    )
  })

  it('start state machine to send SMS with a phone number expected to succeed', done => {
    statebox.startExecution(
      {
        phoneNumber: '07700900111'
      },
      SEND_SMS_STATE_MACHINE_NAME,
      {
        sendResponse: 'COMPLETE'
      },
      (err, executionDescription) => {
        if (process.env.GOV_UK_NOTIFY_API_KEY) {
          expect(err).to.eql(null)
          expect(executionDescription.status).to.eql('SUCCEEDED')
        } else {
          expect(executionDescription.status).to.eql('FAILED')
          expect(executionDescription.errorCode).to.eql('Missing ENV: GOV_UK_NOTIFY_API_KEY')
        }
        done()
      }
    )
  })

  it('should shutdown Tymly', async () => {
    await tymlyService.shutdown()
  })
})
