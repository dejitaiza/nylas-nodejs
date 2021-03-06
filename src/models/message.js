const _ = require('underscore');
const File = require('./file');
const RestfulModel = require('./restful-model');
const Contact = require('./contact');
const Attributes = require('./attributes');
const { Label } = require('./folder');
const { Folder } = require('./folder');

export class Message extends RestfulModel {
  constructor() {
    super(...arguments);
    this.save = this.save.bind(this);
    if (!this.body) {
      this.body = '';
    }
    if (!this.subject) {
      this.subject = '';
    }
    if (!this.to) {
      this.to = [];
    }
    if (!this.cc) {
      this.cc = [];
    }
    if (!this.bcc) {
      this.bcc = [];
    }

    this.collectionName = 'messages';

    this.attributes = _.extend({}, RestfulModel.attributes, {
      to: Attributes.Collection({
        modelKey: 'to',
        itemClass: Contact,
      }),
      cc: Attributes.Collection({
        modelKey: 'cc',
        itemClass: Contact,
      }),
      bcc: Attributes.Collection({
        modelKey: 'bcc',
        itemClass: Contact,
      }),
      from: Attributes.Collection({
        modelKey: 'from',
        itemClass: Contact,
      }),
      date: Attributes.DateTime({
        queryable: true,
        modelKey: 'date',
      }),
      body: Attributes.String({
        modelKey: 'body',
      }),
      files: Attributes.Collection({
        modelKey: 'files',
        itemClass: File,
      }),
      starred: Attributes.Boolean({
        queryable: true,
        modelKey: 'starred',
      }),
      unread: Attributes.Boolean({
        queryable: true,
        modelKey: 'unread',
      }),
      snippet: Attributes.String({
        modelKey: 'snippet',
      }),
      threadId: Attributes.String({
        queryable: true,
        modelKey: 'threadId',
        jsonKey: 'thread_id',
      }),
      subject: Attributes.String({
        modelKey: 'subject',
      }),
      draft: Attributes.Boolean({
        modelKey: 'draft',
        jsonKey: 'draft',
        queryable: true,
      }),
      version: Attributes.Number({
        modelKey: 'version',
        queryable: true,
      }),
      folder: Attributes.Object({
        modelKey: 'folder',
        itemClass: Folder,
      }),
      labels: Attributes.Collection({
        modelKey: 'labels',
        itemClass: Label,
      }),
    });
  }

  fromJSON(json) {
    if (!json) {
      json = {};
    }
    super.fromJSON(json);

    // Only change the `draft` bit if the incoming json has an `object`
    // property. Because of `DraftChangeSet`, it's common for incoming json
    // to be an empty hash. In this case we want to leave the pre-existing
    // draft bit alone.
    if (json.object) {
      this.draft = json.object === 'draft';
    }

    return this;
  }

  // We calculate the list of participants instead of grabbing it from
  // a parent because it is a better source of ground truth, and saves us
  // from more dependencies.
  participants() {
    const participants = {};
    const contacts = _.union(
      this.to != null ? this.to : [],
      this.cc != null ? this.cc : [],
      this.from != null ? this.from : []
    );
    for (const contact of contacts) {
      if (contact && (contact.email ? contact.email.length : undefined) > 0) {
        if (contact) {
          participants[
            `${((contact ? contact.email : undefined) != null
              ? contact ? contact.email : undefined
              : ''
            )
              .toLowerCase()
              .trim()} ${((contact ? contact.name : undefined) != null
              ? contact ? contact.name : undefined
              : ''
            )
              .toLowerCase()
              .trim()}`
          ] = contact;
        }
      }
    }
    return _.values(participants);
  }

  fileIds() {
    return _.map(this.files, file => file.id);
  }

  saveRequestBody() {
    // It's possible to update most of the fields of a draft.
    if (this.constructor.name === 'Draft') {
      return super.saveRequestBody(...arguments);
    }

    // Messages are more limited, though.
    const json = {};
    if (this.labels) {
      json['label_ids'] = Array.from(this.labels).map(label => label.id);
    } else if (this.folder) {
      json['folder_id'] = this.folder.id;
    }

    json['starred'] = this.starred;
    json['unread'] = this.unread;
    return json;
  }

  save(params, callback = null) {
    if (!params) {
      params = {};
    }
    return this._save(params, callback);
  }

  // raw MIME send
  static sendRaw(nylasConnection, message, callback = null) {
    const opts = {
      method: 'POST',
      body: message,
      path: '/send',
    };

    opts.headers = { 'Content-Type': 'message/rfc822' };
    opts.json = false;

    return nylasConnection
      .request(opts)
      .then(json => {
        const msg = new Message(nylasConnection, json);
        if (callback) {
          callback(null, msg);
        }
        return Promise.resolve(msg);
      })
      .catch(function(err) {
        if (callback) {
          callback(err);
        }
        return Promise.reject(err);
      });
  }
}
