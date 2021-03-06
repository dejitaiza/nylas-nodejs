const _ = require('underscore');
const request = require('request');
const Promise = require('bluebird');
const NylasConnection = require('./nylas-connection');
const ManagementAccount = require('./models/management-account');
const Account = require('./models/account');
const RestfulModelCollection = require('./models/restful-model-collection');
const ManagementModelCollection = require('./models/management-model-collection');

export class Nylas {
  constructor() {
    this.appId = null;
    this.appSecret = null;
    this.apiServer = 'https://api.nylas.com';
  }

  static config({ appId, appSecret, apiServer }) {
    if (apiServer && apiServer.indexOf('://') === -1) {
      throw new Error(
        'Please specify a fully qualified URL for the API Server.'
      );
    }

    if (appId) {
      this.appId = appId;
    }
    if (appSecret) {
      this.appSecret = appSecret;
    }
    if (apiServer) {
      this.apiServer = apiServer;
    }

    let conn;
    if (this.hostedAPI()) {
      conn = new NylasConnection(this.appSecret);
      this.accounts = new ManagementModelCollection(
        ManagementAccount,
        conn,
        this.appId
      );
    } else {
      conn = new NylasConnection(this.appSecret);
      this.accounts = new RestfulModelCollection(Account, conn, this.appId);
    }

    return this;
  }

  static hostedAPI() {
    return this.appId != null && this.appSecret != null;
  }

  static with(accessToken) {
    if (!accessToken) {
      throw new Error('This function requires an access token');
    }
    return new NylasConnection(accessToken);
  }

  static exchangeCodeForToken(code, callback) {
    if (!this.appId || !this.appSecret) {
      throw new Error(
        'exchangeCodeForToken() cannot be called until you provide an appId and secret via config()'
      );
    }
    if (!code) {
      throw new Error('exchangeCodeForToken() must be called with a code');
    }

    return new Promise((resolve, reject) => {
      const options = {
        method: 'GET',
        json: true,
        url: `${this.apiServer}/oauth/token`,
        qs: {
          client_id: this.appId,
          client_secret: this.appSecret,
          grant_type: 'authorization_code',
          code: code,
        },
      };

      return request(options, function(error, response, body) {
        if (error) {
          reject(error);
          if (callback) {
            return callback(error);
          }
        } else {
          resolve(body['access_token']);
          if (callback) {
            return callback(null, body['access_token']);
          }
        }
      });
    });
  }

  static urlForAuthentication(options) {
    if (!options) {
      options = {};
    }
    if (!this.appId) {
      throw new Error(
        'urlForAuthentication() cannot be called until you provide an appId via config()'
      );
    }
    if (!options.redirectURI) {
      throw new Error('urlForAuthentication() requires options.redirectURI');
    }
    if (!options.loginHint) {
      options.loginHint = '';
    }
    if (!options.trial) {
      options.trial = false;
    }
    let url = `${this.apiServer}/oauth/authorize?client_id=${this
      .appId}&trial=${options.trial}&response_type=code&scope=email&login_hint=${options.loginHint}&redirect_uri=${options.redirectURI}`;
    if (options.state != null) {
      url += `&state=${options.state}`;
    }
    return url;
  }
}
