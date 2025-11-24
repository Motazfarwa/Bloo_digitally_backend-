// server.js
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const sgMail = require("@sendgrid/mail");
const Candidate = require("./models/condidate");

const app = express();

// --------------------------
// Setup SendGrid
// --------------------------
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// --------------------------
// CORS setup
// --------------------------
const allowedOrigins = [
  "https://bloo-digitaly-frontend.onrender.com"
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (!allowedOrigins.includes(origin)) {
      return callback(new Error(`CORS policy does not allow ${origin}`), false);
    }
    return callback(null, true);
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true,
}));

app.use(express.json());

// --------------------------
// Multer setup for uploads
// --------------------------
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    const uploadDir = path.join(__dirname, "uploads");
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: function(req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  }
});

// Optional: restrict file types and size
const upload = multer({ 
  storage,
  limits: { fileSize: 40 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["application/pdf", "image/png", "image/jpeg"];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error("File type not allowed"), false);
    }
    cb(null, true);
  }
});

// --------------------------
// MongoDB connection
// --------------------------
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error("MongoDB connection error:", err));

// --------------------------
// POST /send-email
// --------------------------
app.post("/send-email", upload.array("files"), async (req, res) => {
  try {
    const {
      fullName,
      email,
      phone,
      linkedin,
      message,
      poste,
      dateNaissance,
      frenchLevel,
      englishLevel,
      interestedCountries,
      acceptTerms,
      service, 
    } = req.body;

    // Map uploaded files
    const uploadedFiles = req.files.map(file => ({
      filename: file.filename,
      path: file.path,
      contentType: file.mimetype
    }));

    // Save candidate to MongoDB
    const candidate = new Candidate({
      fullName,
      email,
      phone,
      linkedin,
      message,
      poste,
      dateNaissance: dateNaissance ? new Date(dateNaissance) : undefined,
      languages: { french: frenchLevel, english: englishLevel },
      interestedCountries: interestedCountries
        ? interestedCountries.split(",").map(c => c.trim())
        : [],
      acceptTerms: acceptTerms === "true" || acceptTerms === true,
      service, 
      files: uploadedFiles,
      submittedAt: new Date()
    });

    await candidate.save();

    // Prepare attachments for SendGrid
    const attachments = uploadedFiles.map(file => ({
      content: fs.readFileSync(file.path).toString("base64"),
      filename: file.filename,
      type: file.contentType,
      disposition: "attachment"
    }));

    // Send email via SendGrid
    const msg = {
      to: "farwamotez@gmail.com",
      from: "farwamotez@gmail.com", // Must be verified in SendGrid
      subject: `New Candidate Submission: ${fullName}`,
      text: `
Service: ${service}     
Full Name: ${fullName}
Email: ${email}
Phone: ${phone}
LinkedIn: ${linkedin}
Desired Position: ${poste}
Date of Birth: ${dateNaissance || "N/A"}
French Level: ${frenchLevel || "N/A"}
English Level: ${englishLevel || "N/A"}
Interested Countries: ${interestedCountries || "N/A"}
Accept Terms: ${acceptTerms}
Message: ${message}
      `,
      attachments,
    };

    await sgMail.send(msg);

    res.status(200).json({ message: "Candidate submitted and email sent successfully!", candidate });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to submit candidate.", error: error.message });
  }
});

// --------------------------
// GET /candidates
// --------------------------
app.get("/candidates", async (req, res) => {
  try {
    const candidates = await Candidate.find().sort({ submittedAt: -1 });
    res.status(200).json(candidates);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch candidates.", error: error.message });
  }
});

// --------------------------
// Serve uploaded files (optional)
// --------------------------
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// --------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
