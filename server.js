const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const cors = require("cors");
const Candidate = require("./models/condidate");
const nodemailer = require("nodemailer");
const path = require("path");
const fs = require("fs");

const app = express();

// Allowed origins for CORS
const allowedOrigins = [
  "https://bloo-digitaly-frontend.onrender.com"
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      return callback(new Error(`CORS policy does not allow ${origin}`), false);
    }
    return callback(null, true);
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true,
}));

app.use(express.json());

// Multer setup: save files to disk
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
const upload = multer({ storage });

// Connect to MongoDB
mongoose
  .connect("mongodb+srv://bloo:bloo@cluster0.8pd4qvi.mongodb.net/")
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// POST endpoint
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
    } = req.body;

    // Map files to MongoDB format (store only paths)
    const uploadedFiles = req.files.map(file => ({
      filename: file.filename,
      path: file.path,
      contentType: file.mimetype
    }));

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
      files: uploadedFiles,
    });

    await candidate.save();

    // --------------------------
    // Send email using Nodemailer
    // --------------------------
    const transporter = nodemailer.createTransport({
     host: "smtp.gmail.com",
     port: 587,        // TLS port
     secure: false,    // false for TLS
    auth: {
     user: process.env.EMAIL_USER,
     pass: process.env.EMAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false
    },
    connectionTimeout: 10000 // optional
  });


    // Prepare attachments from saved files
    const attachments = uploadedFiles.map(file => ({
      filename: file.filename,
      path: file.path
    }));

    const mailOptions = {
      from: `"Bloo Digitally" <${process.env.EMAIL_USER}>`,
      to: "farwamotez@gmail.com",
      subject: `New Candidate Submission: ${fullName}`,
      text: `
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

    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: "Candidate submitted and email sent successfully!", candidate });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to submit candidate.", error });
  }
});

// GET all candidates
app.get("/candidates", async (req, res) => {
  try {
    const candidates = await Candidate.find().sort({ submittedAt: -1 });
    res.status(200).json(candidates);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch candidates.", error });
  }
});

const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
