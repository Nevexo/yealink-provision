// Mongoose Schema - Device Config Elements

// Config elements are assigned to a group, and contain a key/value pair.
// For example, "account.sip.1.server" has three groups, account, sip, and 1.
// 'server' in this example is the config element, which has a value of "sip.example.com".

// Config elements don't have targeting information, they are targeted by the group they are assigned to.

// Elements must have an ID, name, value, group ID, optially a remark, create_date and enable flag.

import mongoose from 'mongoose';
const { Schema } = mongoose;

export const elementSchema = new Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  group_id: { type: String, required: true },
  value: { type: String, required: true },
  remark: { type: String, required: false },
  create_date: { type: Date, required: true, default: Date.now },
  enable: { type: Boolean, required: true, default: true },
});

export const Element = mongoose.model('Element', elementSchema);