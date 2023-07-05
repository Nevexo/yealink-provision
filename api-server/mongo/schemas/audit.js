// Mongoose Schema - Audit Log Entry

// An audit log entry is a single entry in the audit log, created when the user
// changes the configuration of yealink-provision.

import mongoose from 'mongoose';
const { Schema } = mongoose;

export const auditSchema = new Schema({
  id: { type: String, required: true },
  user_id: { type: String, required: true },
  action: { type: String, required: true },
  target_type: { type: String, required: true },
  target_id: { type: String, required: true },
  date: { type: Date, required: true, default: Date.now },
});

export const Audit = mongoose.model('Audit', auditSchema);