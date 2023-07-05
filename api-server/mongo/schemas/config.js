// Mongoose Schema - Device Config Elements

// A device config element is a single configuration element that can be assigned to a device.
// It has a key/value pair that will be converted into a config file entry.
// Config elements require a list of group keys, which is used to determine the hierarchy of the config element.
// The config target_type specifies the type of target this configuration should apply to.
// The config target specifies the exact device that this configuration should apply to, if applicable.
// I.e., a global config element will have a target_type of global, and no target.

import mongoose from 'mongoose';
const { Schema } = mongoose;

export const deviceConfigElementSchema = new Schema({
  id: { type: String, required: true },
  group_keys: { type: Array, required: true },
  key: { type: String, required: true },
  value: { type: String, required: true },
  remark: { type: String, required: false },
  target_type: { type: String, required: true, enum: ['global', 'model', 'site', 'device'] },
  target: { type: String, required: false },
  create_date: { type: Date, required: true, default: Date.now },
  published: { type: Boolean, required: true, default: false },
});

export const DeviceConfigElement = mongoose.model('DeviceConfigElement', deviceConfigElementSchema);