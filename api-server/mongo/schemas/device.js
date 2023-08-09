// Mongoose Schema - Device

// A device is a specific Yealink Phone (or for DECT, a base station).
// It is assigned to a site, and inherits configuration from that site.
// Configuration elements can be assigned to a device, and will override the site configuration.

// TODO - Yealink RPS Authentication.
// This PoC version of yealink-provision does not support the normal
// RPS authentication method. Instead, it uses a 'password' in the URL.

import mongoose from 'mongoose';
const { Schema } = mongoose;

export const deviceSchema = new Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  site_id: { type: String, required: true },
  mac_address: { type: String, required: true },
  model_id: { type: String, required: true },
  description: { type: String, required: false },
  create_date: { type: Date, required: true, default: Date.now },
  enable: { type: Boolean, required: true, default: false },
});

export const Device = mongoose.model('Device', deviceSchema);