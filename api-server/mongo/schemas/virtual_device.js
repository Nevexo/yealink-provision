// Mongoose Schema - Virtual Device

// A virtual device is used to hold configuration for use by duplication, or mirroring
// on "physical" devices. For example, the linekey configuration (for speed dial) may be held
// on a virtual device, and mirored to multiple physical phones.

import mongoose from 'mongoose';
const { Schema } = mongoose;

export const virtualDeviceSchema = new Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  site_id: { type: String, required: true },
  description: { type: String, required: false },
  create_date: { type: Date, required: true, default: Date.now },
  enable: { type: Boolean, required: true, default: false },
});

export const Device = mongoose.model('VirtualDevice', virtualDeviceSchema)