// Mongoose Schema - Fetch Audit Log Entry

// A fetch audit log entry is created whenever a device fetches a configuration file.

import mongoose from 'mongoose';
const { Schema } = mongoose;

export const fetchAuditSchema = new Schema({
  id: { type: String, required: true },
  type: { type: String, required: true, enum: ['device_specific'] },
  device_id: { type: String, required: false },
  success: { type: Boolean, required: true },
  state_string: { type: String, required: true },
  date: { type: Date, required: true, default: Date.now },
  remark: { type: String, required: false },
});

export const FetchAudit = mongoose.model('FetchAudit', fetchAuditSchema);