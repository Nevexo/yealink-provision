// Mongoose Schema - Yealink Device Model

// A Yealink Device Model is a specific Yealink Phone model.
// They must be created in yealink-provision before they can be used, a default set is provided.
// Models are added globally, and can have configuration elements assigned to them.

import mongoose from 'mongoose';
const { Schema } = mongoose;

export const modelSchema = new Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  vendor: { type: String, required: true },
  remark: { type: String, required: false },
  create_date: { type: Date, required: true, default: Date.now },
});

export const Model = mongoose.model('Model', modelSchema);