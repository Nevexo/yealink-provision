// Mongoose Interface - Site

// A "site" is a collection of devices owned by a single tenant.
// Phones are assigned to sites, and can be moved between them.
// Configuration elements can be assigned to a site, and will be inherited by all devices in that site.
// Such as yealink-provision username/password, SIP server, etc.

import mongoose from 'mongoose';
const { Schema } = mongoose;

export const siteSchema = new Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  remark: { type: String, required: false },
  create_date: { type: Date, required: true, default: Date.now },
  enable: { type: Boolean, required: true, default: false },
  password: { type: String, required: true },
}); 

export const Site = mongoose.model('Site', siteSchema);