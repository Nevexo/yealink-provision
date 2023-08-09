// Mongoose Schema - Config Group

// A config group element allows for creating tiered configurations.
// I.e., "account.sip.1.server" has three groups, account, sip, and 1.
// Where "server" is a configuration element.

// To support non-yealink vendors, groups can be called "*" to become
// a root group. I.e., "*.hostname" would be valid.
// This isn't used at all for Yealink, and (TODO) has not yet been tested.

// Groups have an ID, name, remark, create_date, target and enable flag.

// Group targeting is recursive, so a group can target a group, which targets a group, etc.
// The "parent" group must target a model, site or device, and the "child" group must target the parent group.
// Config elements are targeted by the group they are assigned to. 

import mongoose from 'mongoose';
const { Schema } = mongoose;

export const groupSchema = new Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  parent: { type: String, required: false },
  remark: { type: String, required: false },
  create_date: { type: Date, required: true, default: Date.now },
  enable: { type: Boolean, required: true, default: true },
  target_type: { type: String, required: true, enum: ['model', 'site', 'device', 'group'] },
  target_id: { type: String, required: true },
});

export const Group = mongoose.model('Group', groupSchema);