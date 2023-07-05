// Mongoose Schema - Device

// A device is a specific Yealink Phone (or for DECT, a base station).
// It is assigned to a site, and inherits configuration from that site.
// Configuration elements can be assigned to a device, and will override the site configuration.

import mongoose from 'mongoose';
const { Schema } = mongoose;

export const deviceSchema = new Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  site_id: { type: String, required: true },
  mac_address: { type: String, required: true },
  password: { type: String, required: true },
  model_id: { type: String, required: true },
  inherit_site_config: { type: Boolean, required: true, default: true },
  inherit_model_config: { type: Boolean, required: true, default: true },
  inherit_global_config: { type: Boolean, required: true, default: true },
  description: { type: String, required: false },
  create_date: { type: Date, required: true, default: Date.now },
  published: { type: Boolean, required: true, default: false },
});

export const Device = mongoose.model('Device', deviceSchema);