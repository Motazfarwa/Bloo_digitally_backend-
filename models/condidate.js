const mongoose = require("mongoose");

const candidateSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String },
    linkedin: { type: String },
    message: { type: String },

    files: [
      {
        data: Buffer,
        contentType: String,
        filename: String,
      },
    ],

    poste: { type: String },
    languages: { french: String, english: String },
    interestedCountries: [{ type: String }],
    dateNaissance: { type: Date },
    acceptTerms: { type: Boolean, default: false },
    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const Candidate = mongoose.model("Candidate", candidateSchema);
module.exports = Candidate;
