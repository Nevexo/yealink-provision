// Mongoose Schema - Yealink Device Model

// A Yealink Device Model is a specific Yealink Phone model.
// They must be created in yealink-provision before they can be used, a default set is provided.
// Models are added globally, and can have configuration elements assigned to them.

import mongoose from 'mongoose';
const { Schema } = mongoose;

export const modelSchema = new Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String, required: false },
  yealink_default_config_id: { type: String, required: true }, // This is the name of the default config file that this device should expect.
  create_date: { type: Date, required: true, default: Date.now },
});

export const Model = mongoose.model('Model', modelSchema);