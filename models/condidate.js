const mongoose = require("mongoose");

const candidateSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String },
    linkedin: { type: String },
    message: { type: String },

    // Store uploaded file info as path (not Buffer)
    files: [
      {
        filename: { type: String },
        path: { type: String },
        contentType: { type: String },
      },
    ],

    poste: { type: String },
    languages: { 
      french: { type: String },
      english: { type: String }
    },
    interestedCountries: [{ type: String }],
    dateNaissance: { type: Date },
    acceptTerms: { type: Boolean, default: false },

    // ✅ New field added
    service: { 
      type: String,
      enum: ["Job Search", "Study Abroad", "Volunteer Registration"], // optional validation
      required: false, // set to true if you want to make it mandatory
    },

    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const Candidate = mongoose.model("Candidate", candidateSchema);
module.exports = Candidate;
