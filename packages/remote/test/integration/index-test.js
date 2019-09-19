'use strict';

const { describe, it } = require('../../../../helpers/mocha');
const { expect } = require('../../../../helpers/chai');
const fkill = require('fkill');
const {
  killOrphans,
  getNewPort,
  startWebDriver: _startWebDriver,
  startBrowser: _startBrowser,
} = require('../../src');
const Server = require('../../../../helpers/server');

const shouldTestFirefox = process.env.WEBDRIVER_BROWSER === 'firefox' || process.env.FIREFOX_INSTALLED;

describe(function() {
  this.timeout(10 * 1000);

  async function startWebDriver(browser) {
    return await _startWebDriver({ browser, port: '0' });
  }

  async function startBrowser(browser) {
    return await _startBrowser({ browser, size: null });
  }

  async function waitForWebDriverExit(webDriver) {
    return await new Promise(resolve => {
      webDriver.once('exit', resolve);
    });
  }

  async function waitForBrowserExit(browser) {
    return await new Promise(resolve => {
      (function restart() {
        browser.status().then(restart).catch(err => {
          if (err.code !== 'ECONNREFUSED') {
            throw err;
          }

          resolve();
        });
      })();
    });
  }

  afterEach(async function() {
    await killOrphans();
  });

  describe('crashed web driver cleans up browsers', function() {
    async function test(_browser) {
      let webDriver = await startWebDriver(_browser);

      let webDriverPromise = waitForWebDriverExit(webDriver);

      let browser = await startBrowser(_browser);

      let browserPromise = waitForBrowserExit(browser);

      await fkill(webDriver.pid);

      await Promise.all([
        expect(webDriverPromise, 'web driver is cleaned up').to.eventually.be.fulfilled,
        expect(browserPromise, 'browser is cleaned up').to.eventually.be.fulfilled,
      ]);
    }

    it('chrome', async function() {
      await test('chrome');
    });

    (shouldTestFirefox ? it : it.skip)('firefox', async function() {
      await test('firefox');
    });
  });

  describe(killOrphans, function() {
    it('cleans up web drivers', async function() {
      let webDrivers = await Promise.all([
        startWebDriver('chrome'),
        startWebDriver('firefox'),
      ]);

      let [
        chromePromise,
        firefoxPromise,
      ] = webDrivers.map(waitForWebDriverExit);

      await killOrphans();

      await Promise.all([
        expect(chromePromise, 'chrome is cleaned up').to.eventually.be.fulfilled,
        expect(firefoxPromise, 'firefox is cleaned up').to.eventually.be.fulfilled,
      ]);
    });

    describe('cleans up browsers too', function() {
      async function test(_browser) {
        let webDriver = await startWebDriver(_browser);

        let webDriverPromise = waitForWebDriverExit(webDriver);

        let browser = await startBrowser(_browser);

        let browserPromise = waitForBrowserExit(browser);

        await killOrphans();

        await Promise.all([
          expect(webDriverPromise, 'web driver is cleaned up').to.eventually.be.fulfilled,
          expect(browserPromise, 'browser is cleaned up').to.eventually.be.fulfilled,
        ]);
      }

      it('chrome', async function() {
        await test('chrome');
      });

      (shouldTestFirefox ? it : it.skip)('firefox', async function() {
        await test('firefox');
      });
    });
  });

  describe(getNewPort, function() {
    let server;

    async function consumePort(port) {
      server = new Server();

      await server.start(port);
    }

    afterEach(async function() {
      if (server) {
        await server.stop();

        server = null;
      }
    });

    it('returns requested port when in use', async function() {
      let requested = '4444';

      await consumePort(requested);

      let actual = await getNewPort(requested);

      expect(actual).to.equal(requested);
    });

    it('returns random port when zero', async function() {
      let requested = '0';

      let actual = await getNewPort(requested);

      expect(actual).to.not.equal(requested);
      expect(actual).to.be.a('string');
      expect(parseInt(actual)).to.be.a('number');
    });

    it('returns random port when falsy', async function() {
      let requested = null;

      let actual = await getNewPort(requested);

      expect(actual).to.not.equal(requested);
      expect(actual).to.be.a('string');
      expect(parseInt(actual)).to.be.a('number');
    });
  });
});
